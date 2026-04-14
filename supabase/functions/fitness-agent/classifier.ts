// supabase/functions/fitness-agent/classifier.ts
import { GoogleGenAI } from "npm:@google/genai";
import { CLASSIFIER_PROMPT } from "./prompts.ts";

const MODEL_NAME = "gemini-3-flash-preview";
const TIMEOUT_MS = 3000;

export async function classify(
  ai: GoogleGenAI,
  question: string,
): Promise<"simple" | "complex"> {
  const timeoutPromise = new Promise<"simple">((resolve) =>
    setTimeout(() => resolve("simple"), TIMEOUT_MS)
  );

  const classifyPromise = (async (): Promise<"simple" | "complex"> => {
    try {
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: question,
        config: { systemInstruction: CLASSIFIER_PROMPT },
      });
      const answer = (result.text ?? "").trim().toLowerCase();
      return answer === "complex" ? "complex" : "simple";
    } catch (err) {
      console.warn("Classifier failed, defaulting to simple. Error:", err);
      return "simple";
    }
  })();

  return Promise.race([classifyPromise, timeoutPromise]);
}
