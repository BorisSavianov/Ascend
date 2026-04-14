// supabase/functions/fitness-agent/simple.ts
import { GoogleGenAI } from "npm:@google/genai";
import { type SupabaseClient } from "npm:@supabase/supabase-js";
import { type UserTargets } from "./prompts.ts";

const MODEL_NAME = "gemini-3-flash-preview";

type HistoryItem = { role: "user" | "model"; parts: { text: string }[] };

const FOOD_RE = /food|ate|eat|meal|item|ingredient/i;
const FAST_RE = /fast|window|break|16:8|intermittent/i;

export async function simplePath(params: {
  ai: GoogleGenAI;
  supabase: SupabaseClient;
  userId: string;
  question: string;
  windowDays: number;
  userTargets: UserTargets;
  history: HistoryItem[];
  systemPrompt: string;
}): Promise<ReadableStream<Uint8Array>> {
  const includeDetailedMeals = FOOD_RE.test(params.question);
  const includeFasting = FAST_RE.test(params.question);

  console.log(`Starting simplePath for user ${params.userId}. IncludeMeals: ${includeDetailedMeals}, IncludeFasting: ${includeFasting}`);

  const { data: context, error: rpcError } = await params.supabase.rpc("assemble_full_context", {
    p_user_id: params.userId,
    p_window_days: params.windowDays,
    p_calorie_target: params.userTargets.calorieTarget,
    p_macro_targets: params.userTargets.macroTargets,
    p_fasting_target: params.userTargets.fastingTargetHours,
  });

  if (rpcError) {
    console.error("RPC Error in simplePath:", rpcError);
    throw new Error(`Failed to fetch context: ${rpcError.message}`);
  }

  // Trim context client-side: drop meals detail if not food question, drop fasting if not fasting question.
  // Note: assemble_full_context always fetches all data; trimming happens post-SQL.
  // The benefit is reduced context sent to the model, not reduced SQL work.
  const trimmed = { ...context };
  if (!includeDetailedMeals) delete trimmed.meals;
  if (!includeFasting) delete trimmed.fasting_logs;

  // Inject history as readable text prefix
  const historyText = params.history.length > 0
    ? params.history
      .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.parts.map((p) => p.text).join("")}`)
      .join("\n") + "\n\n"
    : "";

  const userMessage =
    `${historyText}Here is my fitness data (JSON):\n${JSON.stringify(trimmed)}\n\nMy question: ${params.question}`;

  const stream = await params.ai.models.generateContentStream({
    model: MODEL_NAME,
    contents: userMessage,
    config: { systemInstruction: params.systemPrompt },
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text ?? "";
          controller.enqueue(encoder.encode(text));
        }
        console.log("simplePath stream completed successfully.");
        controller.close();
      } catch (err) {
        console.error("Error in simplePath stream phase:", err);
        controller.error(err);
      }
    },
  });
}
