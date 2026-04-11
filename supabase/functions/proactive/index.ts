// supabase/functions/proactive/index.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "npm:@supabase/supabase-js";
import { PROACTIVE_PROMPT } from "../fitness-agent/prompts.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MODEL_NAME = "gemini-2.0-flash";

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  // Get all users who have a push token
  const { data: tokens } = await supabase
    .from("user_push_tokens")
    .select("user_id, expo_token");

  if (!tokens?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
  let processed = 0;

  for (const { user_id, expo_token } of tokens) {
    // Skip users with no data in the past 7 days
    const { count } = await supabase
      .from("daily_summaries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("log_date", since);

    if (!count) continue;

    // Assemble 7-day context
    const { data: context, error: ctxErr } = await supabase.rpc("assemble_full_context", {
      p_user_id: user_id,
      p_window_days: 7,
    });
    if (ctxErr) continue;

    // Generate insight
    let insight: string;
    try {
      const result = await model.generateContent(
        `${PROACTIVE_PROMPT}\n\nData:\n${JSON.stringify(context)}`,
      );
      insight = result.response.text().trim();
    } catch {
      continue;
    }

    // Store insight
    const { data: insightRow } = await supabase
      .from("ai_proactive_insights")
      .insert({ user_id, content: insight })
      .select("id")
      .single();

    if (!insightRow) continue;

    // Send push notification
    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: expo_token,
        title: "Weekly fitness insight",
        body: insight.length > 100 ? insight.slice(0, 97) + "..." : insight,
        data: { insightId: insightRow.id },
      }),
    });

    if (pushRes.ok) {
      await supabase
        .from("ai_proactive_insights")
        .update({ notified: true })
        .eq("id", insightRow.id);
    }

    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { "Content-Type": "application/json" },
  });
});
