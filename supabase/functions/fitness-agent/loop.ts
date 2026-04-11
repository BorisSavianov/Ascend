// supabase/functions/fitness-agent/loop.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { type SupabaseClient } from "npm:@supabase/supabase-js";
import { TOOL_DECLARATIONS, executeTool } from "./tools.ts";

const MODEL_NAME = "gemini-2.0-flash";
const MAX_TOOL_ITERATIONS = 2; // max tool-call rounds in the while loop before falling back to synthesis

type HistoryItem = { role: "user" | "model"; parts: { text: string }[] };

export async function toolLoopPath(params: {
  genAI: GoogleGenerativeAI;
  supabase: SupabaseClient;
  userId: string;
  question: string;
  history: HistoryItem[];
  systemPrompt: string;
}): Promise<ReadableStream<Uint8Array>> {
  const model = params.genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: params.systemPrompt,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
  });

  const chat = model.startChat({ history: params.history });

  let response = await chat.sendMessage(params.question);
  const toolResults: { name: string; result: unknown }[] = [];
  let iterations = 0;

  type FnCallPart = { functionCall: { name: string; args: Record<string, unknown> } };

  // Tool-calling loop — handle all parallel function calls per iteration
  while (iterations < MAX_TOOL_ITERATIONS) {
    const parts = response.response.candidates?.[0]?.content?.parts ?? [];
    const fnCalls = parts.filter(
      (p: { functionCall?: unknown }): p is FnCallPart => !!p.functionCall,
    );
    if (fnCalls.length === 0) break;

    const responses = await Promise.all(
      fnCalls.map(async (fnCall) => {
        const result = await executeTool(
          fnCall.functionCall.name,
          fnCall.functionCall.args ?? {},
          params.supabase,
          params.userId,
        );
        return { name: fnCall.functionCall.name, result };
      }),
    );
    // Push in fnCalls order (not completion order) so toolSummary is deterministic
    for (const r of responses) {
      toolResults.push({ name: r.name, result: r.result });
    }

    response = await chat.sendMessage(
      responses.map((r) => ({ functionResponse: { name: r.name, response: { result: r.result } } })),
    );
    iterations++;
  }

  // Check if model produced a text response from the loop
  const textPart = response.response.candidates?.[0]?.content?.parts?.find(
    (p: { text?: string }) => p.text,
  );
  if (textPart?.text) {
    const encoder = new TextEncoder();
    const text = textPart.text as string;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
  }

  // Model exhausted tools without synthesising — do a final streaming synthesis call
  const synthesisModel = params.genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: params.systemPrompt,
  });

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

  const streamResult = await synthesisModel.generateContentStream(synthesisPrompt);

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
