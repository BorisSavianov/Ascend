// supabase/functions/fitness-agent/index.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "npm:@supabase/supabase-js";
import { classify } from "./classifier.ts";
import { buildSystemPrompt, type UserTargets } from "./prompts.ts";
import { simplePath } from "./simple.ts";
import { toolLoopPath } from "./loop.ts";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

async function generateThreadSummary(
  genAI: GoogleGenerativeAI,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
    .join("\n");
  try {
    const result = await model.generateContent(
      `Summarise this fitness assistant conversation in 3-4 sentences, focusing on the key questions asked and insights given. Do not include greetings or sign-offs.\n\n${transcript}`,
    );
    return result.response.text().trim();
  } catch {
    return "";
  }
}

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
    .select("id, title, summary")
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

  // Load recent messages and thread summary
  const { data: allMessages } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const messageCount = allMessages?.length ?? 0;

  // If thread is long, use summary + last 2 messages; otherwise use last 6 messages
  let history: { role: "user" | "model"; parts: { text: string }[] }[] = [];

  if (messageCount > 10) {
    // Check if summary exists; if not, generate and store it
    let summary = existingThread?.summary ?? "";
    if (!summary && allMessages) {
      summary = await generateThreadSummary(genAI, allMessages.slice(0, -2));
      if (summary) {
        await supabase
          .from("ai_threads")
          .update({ summary })
          .eq("id", threadId);
      }
    }
    const last2 = (allMessages ?? []).slice(-2);
    const summaryText = summary
      ? `[Prior conversation summary: ${summary}]\n\n`
      : "";
    // Inject summary as first history item, then last 2 turns
    if (summaryText) {
      history.push({ role: "user", parts: [{ text: summaryText + (last2[0]?.content ?? "") }] });
      if (last2[1]) {
        history.push({ role: "model", parts: [{ text: last2[1].content }] });
      }
    } else {
      history = last2.map((m) => ({
        role: m.role === "user" ? "user" : "model" as "user" | "model",
        parts: [{ text: m.content }],
      }));
    }
  } else {
    history = (allMessages ?? []).slice(-6).map((m) => ({
      role: m.role === "user" ? "user" : "model" as "user" | "model",
      parts: [{ text: m.content }],
    }));
  }

  const isFirstMessage = messageCount === 0;

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
        { thread_id: threadId, role: "user", content: message },
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
