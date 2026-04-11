// supabase/functions/fitness-agent/classifier.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { CLASSIFIER_PROMPT } from "./prompts.ts";

const MODEL_NAME = "gemini-2.0-flash";
const TIMEOUT_MS = 3000;

export async function classify(
  genAI: GoogleGenerativeAI,
  question: string,
): Promise<"simple" | "complex"> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const timeoutPromise = new Promise<"simple">((resolve) =>
    setTimeout(() => resolve("simple"), TIMEOUT_MS)
  );

  const classifyPromise = (async (): Promise<"simple" | "complex"> => {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: question }] }],
        systemInstruction: CLASSIFIER_PROMPT,
      });
      const answer = result.response.text().trim().toLowerCase();
      return answer === "complex" ? "complex" : "simple";
    } catch {
      return "simple";
    }
  })();

  return Promise.race([classifyPromise, timeoutPromise]);
}
