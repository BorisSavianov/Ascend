// lib/gemini.ts
import { supabase } from "./supabase";

const FUNCTIONS_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const EDGE_FUNCTION_URL = `${FUNCTIONS_BASE}/gemini`;
const FITNESS_AGENT_URL = `${FUNCTIONS_BASE}/fitness-agent`;

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

  // React Native (Expo Go) doesn't expose response.body as a ReadableStream,
  // so fall back to reading the full response text at once.
  if (!response.body) {
    try {
      const text = await response.text();
      if (text) onChunk(text);
      onComplete();
    } catch {
      onError(new Error("Failed to read response"));
    }
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
): Promise<string> {
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
  return response.text();
}

export async function sendMessage(params: {
  threadId: string;
  message: string;
  windowDays: number;
  userTargets: {
    calorieTarget: number;
    macroTargets: { protein: number; fat: number; carbs: number };
    fastingTargetHours: number;
  };
  onChunk: (chunk: string) => void;
  onComplete: (path: "simple" | "complex") => void;
  onError: (error: Error) => void;
}): Promise<void> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session) {
    params.onError(new Error("Not authenticated"));
    return;
  }

  let response: Response;
  try {
    response = await fetch(FITNESS_AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        thread_id: params.threadId,
        message: params.message,
        window_days: params.windowDays,
        user_targets: params.userTargets,
      }),
    });
  } catch {
    params.onError(new Error("Network error — check connection"));
    return;
  }

  if (!response.ok) {
    params.onError(new Error(`Request failed: ${response.status}`));
    return;
  }

  const rawPath = response.headers.get("X-Path");
  const path: "simple" | "complex" = rawPath === "complex" ? "complex" : "simple";

  if (!response.body) {
    try {
      const text = await response.text();
      if (text) params.onChunk(text);
      params.onComplete(path);
    } catch {
      params.onError(new Error("Failed to read response"));
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      params.onChunk(decoder.decode(value, { stream: true }));
    }
    const remaining = decoder.decode();
    if (remaining) params.onChunk(remaining);
    params.onComplete(path);
  } catch {
    params.onError(new Error("Stream interrupted"));
  }
}
