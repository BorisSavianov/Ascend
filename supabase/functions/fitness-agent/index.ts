// supabase/functions/fitness-agent/index.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "npm:@supabase/supabase-js";
import { classify } from "./classifier.ts";
import { buildSystemPrompt, type UserTargets } from "./prompts.ts";
import { simplePath } from "./simple.ts";
import { toolLoopPath } from "./loop.ts";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  let body: {
    thread_id?: string;
    message?: string;
    window_days?: number;
    user_targets?: {
      calorieTarget?: number;
      macroTargets?: { protein: number; fat: number; carbs: number };
      fastingTargetHours?: number;
    };
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const threadId = body.thread_id;
  if (!threadId) {
    return new Response(JSON.stringify({ error: "thread_id is required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const windowDays = Math.min(Math.max(1, Math.floor(body.window_days ?? 14)), 90);

  const userTargets: UserTargets = {
    calorieTarget: body.user_targets?.calorieTarget ?? null,
    macroTargets: body.user_targets?.macroTargets ?? null,
    fastingTargetHours: body.user_targets?.fastingTargetHours ?? null,
  };

  // Ensure thread exists in DB (upsert so client-generated UUID is accepted)
  const { data: existingThread } = await supabase
    .from("ai_threads")
    .select("id, title")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingThread) {
    await supabase.from("ai_threads").insert({
      id: threadId,
      user_id: user.id,
      last_active: new Date().toISOString(),
    });
  }

  // Load last 6 messages as history
  const { data: recentMessages } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(6);

  const history = (recentMessages ?? [])
    .reverse()
    .map((m) => ({
      role: m.role === "user" ? "user" : "model" as "user" | "model",
      parts: [{ text: m.content }],
    }));

  const isFirstMessage = !existingThread && (recentMessages ?? []).length === 0;

  // Classify
  const path = await classify(genAI, message);

  // Build system prompt with user targets
  const systemPrompt = buildSystemPrompt(userTargets);

  // Get the appropriate stream
  let contentStream: ReadableStream<Uint8Array>;
  try {
    if (path === "complex") {
      contentStream = await toolLoopPath({
        genAI,
        supabase,
        userId: user.id,
        question: message,
        windowDays,
        history,
        systemPrompt,
      });
    } else {
      contentStream = await simplePath({
        genAI,
        supabase,
        userId: user.id,
        question: message,
        windowDays,
        userTargets,
        history,
        systemPrompt,
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Agent error", detail: String(err) }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Pipe content stream → response, accumulate full text for persistence
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const decoder = new TextDecoder();

  (async () => {
    let fullText = "";
    try {
      const reader = contentStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        await writer.write(value);
      }
      fullText += decoder.decode();

      // Persist user + assistant messages
      await supabase.from("ai_messages").insert([
        { thread_id: threadId, role: "user", content: message, user_id: undefined },
        { thread_id: threadId, role: "assistant", content: fullText, path },
      ]);

      // Set title on first message (truncate to 60 chars)
      const updates: Record<string, string> = { last_active: new Date().toISOString() };
      if (isFirstMessage) updates.title = message.slice(0, 60);
      await supabase.from("ai_threads").update(updates).eq("id", threadId);

      await writer.close();
    } catch (err) {
      await writer.abort(err);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Path": path,
    },
  });
});
