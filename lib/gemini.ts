// lib/gemini.ts
import { supabase } from "./supabase";

const FUNCTIONS_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const EDGE_FUNCTION_URL = `${FUNCTIONS_BASE}/gemini`;

export async function streamGeminiResponse(
  question: string,
  windowDays = 14,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session) {
    onError(new Error("Not authenticated"));
    return;
  }
  const session = data.session;

  let response: Response;
  try {
    response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ question, window_days: windowDays }),
    });
  } catch {
    onError(new Error("Network error — check connection"));
    return;
  }

  if (!response.ok) {
    onError(new Error(`Request failed: ${response.status}`));
    return;
  }

  if (!response.body) {
    onError(new Error("No response body"));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
    const remaining = decoder.decode();
    if (remaining) onChunk(remaining);
    onComplete();
  } catch {
    onError(new Error("Stream interrupted"));
  }
}

export async function triggerExport(
  format: "markdown" | "csv",
  days = 30
): Promise<Blob> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session) throw new Error("Not authenticated");
  const session = data.session;

  const url = `${FUNCTIONS_BASE}/export`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ format, days }),
  });

  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  return response.blob();
}
