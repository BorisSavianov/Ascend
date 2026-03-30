// supabase/functions/gemini/index.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "npm:@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
const MODEL_NAME = "gemini-2.0-flash";

const SYSTEM_INSTRUCTION = `
You are a personal nutrition analyst for a single user.

USER PROFILE:
- Eating pattern: 16:8 intermittent fasting, 2 meals per day
- Diet style: primarily meat-based and Bulgarian dairy (kashkaval, kiselo mlyako)
- Occasional: oats with kiselo mlyako and homemade honey
- Logging precision: portion estimates — treat all gram weights as approximations (±15%)
- Goals: body composition improvement (weight and body fat % tracked)
- Language: respond in the same language the user writes in

ANALYTICAL GUIDELINES:
- Answer analytically and concisely; do not moralise or hedge
- When data is insufficient, state exactly what is missing
- Reference specific dates when making trend claims
- Bulgarian food names may appear alongside English names — treat as equivalent
- Portion descriptions like "large piece" or "handful" are intentional;
  estimate gram equivalents and note the assumption
- Do not repeat raw data back to the user; interpret and summarise it
`.trim();

async function callWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  prompt: string,
  maxRetries = 3
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await model.generateContentStream(prompt);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  let body: { question?: string; window_days?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const question = body.question?.trim();
  if (!question) {
    return new Response(
      JSON.stringify({ error: "question is required" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  const windowDays = Math.min(Math.max(1, Math.floor(body.window_days ?? 14)), 90);

  const { data: context, error: ctxError } = await supabase.rpc(
    "assemble_ai_context",
    { p_user_id: user.id, p_window_days: windowDays }
  );
  if (ctxError) {
    return new Response(
      JSON.stringify({ error: "Context assembly failed", detail: ctxError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const contextJson = JSON.stringify(context);

  const hashInput = new TextEncoder().encode(contextJson + question);
  const hashBuffer = await crypto.subtle.digest("SHA-256", hashInput);
  const hash = btoa(Array.from(new Uint8Array(hashBuffer), b => String.fromCharCode(b)).join(""));
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();

  const { data: cached } = await supabase
    .from("ai_insights_cache")
    .select("response")
    .eq("user_id", user.id)
    .eq("context_hash", hash)
    .gt("created_at", oneHourAgo)
    .maybeSingle();

  if (cached) {
    return new Response(cached.response, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Cache": "HIT",
      },
    });
  }

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const userMessage = `Here is my nutrition log data (JSON):\n${contextJson}\n\nMy question: ${question}`;

  let streamResult;
  try {
    streamResult = await callWithRetry(model, userMessage);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Gemini API error", detail: String(err) }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let fullText = "";
    let totalTokens = 0;

    try {
      for await (const chunk of streamResult.stream) {
        const text = chunk.text();
        fullText += text;
        await writer.write(encoder.encode(text));
      }

      try {
        const finalResponse = await streamResult.response;
        totalTokens = finalResponse.usageMetadata?.totalTokenCount ?? 0;
      } catch { /* usage metadata is best-effort */ }

      await supabase.from("ai_insights_cache").upsert({
        user_id:      user.id,
        context_hash: hash,
        question,
        response:     fullText,
        model:        MODEL_NAME,
        tokens_used:  totalTokens,
      });

      await writer.close();
    } catch (err) {
      await writer.abort(err);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Cache": "MISS",
    },
  });
});
