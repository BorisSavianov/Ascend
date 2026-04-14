// supabase/functions/fitness-agent/loop.ts
import { GoogleGenAI } from "npm:@google/genai";
import { type SupabaseClient } from "npm:@supabase/supabase-js";
import { TOOL_DECLARATIONS, executeTool } from "./tools.ts";

const MODEL_NAME = "gemini-3-flash-preview";
const MAX_TOOL_ITERATIONS = 2; // max tool-call rounds in the while loop before falling back to synthesis

type HistoryItem = { role: "user" | "model"; parts: { text: string }[] };

export async function toolLoopPath(params: {
  ai: GoogleGenAI;
  supabase: SupabaseClient;
  userId: string;
  question: string;
  history: HistoryItem[];
  systemPrompt: string;
}): Promise<ReadableStream<Uint8Array>> {
  console.log(`Starting toolLoopPath for user ${params.userId}. Question: ${params.question.slice(0, 50)}...`);

  // deno-lint-ignore no-explicit-any
  const contents: any[] = [
    ...params.history,
    { role: "user", parts: [{ text: params.question }] },
  ];

  const toolConfig = {
    systemInstruction: params.systemPrompt,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
  };

  let response = await params.ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config: toolConfig,
  });

  const toolResults: { name: string; result: unknown }[] = [];
  let iterations = 0;

  // Tool-calling loop — handle all parallel function calls per iteration
  while (iterations < MAX_TOOL_ITERATIONS) {
    const fnCalls: Array<{ name: string; args?: Record<string, unknown> }> = response.functionCalls ?? [];
    if (fnCalls.length === 0) break;

    // Append model's function-call turn so subsequent requests have full context
    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responses = await Promise.all(
      fnCalls.map(async (fnCall) => {
        console.log(`Executing tool: ${fnCall.name} with args:`, fnCall.args);
        const result = await executeTool(
          fnCall.name,
          (fnCall.args as Record<string, unknown>) ?? {},
          params.supabase,
          params.userId,
        );
        return { name: fnCall.name, result };
      }),
    );
    // Push in fnCalls order (not completion order) so toolSummary is deterministic
    for (const r of responses) {
      toolResults.push({ name: r.name, result: r.result });
    }

    // Append function responses as a user turn
    contents.push({
      role: "user",
      parts: responses.map((r) => ({
        functionResponse: { name: r.name, response: { result: r.result } },
      })),
    });

    response = await params.ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: toolConfig,
    });
    console.log(`Tool iteration ${iterations + 1} complete. Resulting text: ${!!response.text}`);
    iterations++;
  }

  // Check if model produced a text response from the loop
  if (response.text) {
    const encoder = new TextEncoder();
    const text = response.text;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
  }

  // Model exhausted tools without synthesising — do a final streaming synthesis call
  const toolSummary = toolResults
    .map((t) => `${t.name} result:\n${JSON.stringify(t.result)}`)
    .join("\n\n");

  const historyText = params.history.length > 0
    ? params.history
      .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.parts.map((p) => p.text).join("")}`)
      .join("\n") + "\n\n"
    : "";

  const synthesisPrompt =
    `${historyText}User question: ${params.question}\n\nData retrieved:\n${toolSummary}\n\nSynthesize a concise analytical response.`;

  const stream = await params.ai.models.generateContentStream({
    model: MODEL_NAME,
    contents: synthesisPrompt,
    config: { systemInstruction: params.systemPrompt },
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk.text ?? ""));
        }
        console.log("toolLoopPath synthesis stream completed successfully.");
        controller.close();
      } catch (err) {
        console.error("Error in toolLoopPath synthesis stream:", err);
        controller.error(err);
      }
    },
  });
}
