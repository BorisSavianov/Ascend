// supabase/functions/fitness-agent/simple.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { type SupabaseClient } from "npm:@supabase/supabase-js";
import { type UserTargets } from "./prompts.ts";

const MODEL_NAME = "gemini-2.0-flash";

type HistoryItem = { role: "user" | "model"; parts: { text: string }[] };

const FOOD_RE = /food|ate|eat|meal|item|ingredient/i;
const FAST_RE = /fast|window|break|16:8|intermittent/i;

export async function simplePath(params: {
  genAI: GoogleGenerativeAI;
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

  const { data: context } = await params.supabase.rpc("assemble_full_context", {
    p_user_id: params.userId,
    p_window_days: params.windowDays,
    p_calorie_target: params.userTargets.calorieTarget,
    p_macro_targets: params.userTargets.macroTargets,
    p_fasting_target: params.userTargets.fastingTargetHours,
  });

  // Build compressed context: drop meals detail if not food question, drop fasting if not fasting question
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

  const model = params.genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: params.systemPrompt,
  });

  const streamResult = await model.generateContentStream(userMessage);

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamResult.stream) {
          controller.enqueue(encoder.encode(chunk.text()));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
