# Phase 3: AI Chat & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Gemini-powered AI chat screen and data export (Markdown/CSV) to the nutrition tracker, with all AI calls proxied through a Supabase Edge Function so the API key never touches the mobile client.

**Architecture:** Two Supabase Edge Functions (`/gemini` and `/export`) handle server-side logic. The mobile app calls them via `fetch` with the user's JWT. The Insights tab becomes a streaming chat UI driven by `useGeminiChat` hook. Export uses `expo-file-system` + `expo-sharing` to write a temp file and invoke the native share sheet.

**Tech Stack:** Deno/TypeScript (Edge Functions), `@google/generative-ai` npm package (in Deno), React Native + Expo SDK 52, `expo-file-system`, `expo-sharing`, TanStack Query (already installed), Zustand (already installed).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/functions/gemini/index.ts` | Create | Edge Function: auth, context assembly, Gemini streaming, cache |
| `supabase/functions/export/index.ts` | Create | Edge Function: auth, fetch meals+metrics, emit CSV or Markdown |
| `lib/gemini.ts` | Create | Mobile helper: `streamGeminiResponse`, `triggerExport` |
| `hooks/useGeminiChat.ts` | Create | React hook: message state, streaming, error |
| `constants/prompts.ts` | Create | `QUICK_PROMPTS` constant array |
| `app/(tabs)/insights.tsx` | Modify | Replace placeholder with full chat UI |
| `app/(tabs)/profile.tsx` | Modify | Wire up export buttons in `ExportSection` |

---

## Task 1: Supabase Edge Function — `/gemini`

**Files:**
- Create: `supabase/functions/gemini/index.ts`

- [ ] **Step 1: Create the file**

```typescript
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
  const windowDays = body.window_days ?? 14;

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
  const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
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
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Cache": "MISS",
    },
  });
});
```

- [ ] **Step 2: Verify the file exists**

```bash
ls supabase/functions/gemini/index.ts
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/gemini/index.ts
git commit -m "feat: add gemini edge function with streaming and cache"
```

---

## Task 2: Supabase Edge Function — `/export`

**Files:**
- Create: `supabase/functions/export/index.ts`

- [ ] **Step 1: Create the file**

```typescript
// supabase/functions/export/index.ts
import { createClient } from "npm:@supabase/supabase-js";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (error || !user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const format: "markdown" | "csv" = body.format ?? "markdown";
  const days: number = body.days ?? 30;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [mealsRes, metricsRes] = await Promise.all([
    supabase
      .from("meals")
      .select("*, meal_items(*)")
      .eq("user_id", user.id)
      .gte("logged_at", since)
      .order("logged_at", { ascending: false }),
    supabase
      .from("body_metrics")
      .select("*")
      .eq("user_id", user.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
  ]);

  if (format === "csv") {
    const rows = ["date,meal,food,amount_g,portion,calories,protein_g,fat_g,carbs_g,fiber_g"];
    for (const meal of mealsRes.data ?? []) {
      for (const item of meal.meal_items ?? []) {
        rows.push([
          meal.logged_at.split("T")[0],
          `Meal ${meal.meal_index}`,
          item.food_name,
          item.amount_g ?? "",
          item.portion_desc ?? "",
          item.calories,
          item.protein_g,
          item.fat_g,
          item.carbs_g,
          item.fiber_g,
        ].join(","));
      }
    }
    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nutrition-export.csv"`,
      },
    });
  }

  // Markdown format
  const lines: string[] = [
    "# Nutrition Log Export",
    `Generated: ${new Date().toISOString().split("T")[0]}`,
    `Period: last ${days} days`,
    "",
  ];

  const byDate = new Map<string, typeof mealsRes.data>();
  for (const meal of mealsRes.data ?? []) {
    const date = meal.logged_at.split("T")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(meal);
  }

  for (const [date, meals] of [...byDate.entries()].sort().reverse()) {
    lines.push(`## ${date}`);
    for (const meal of meals) {
      const time = meal.logged_at.split("T")[1].slice(0, 5);
      const mealCal = meal.meal_items?.reduce((s: number, i: { calories: number }) => s + i.calories, 0) ?? 0;
      lines.push(`### Meal ${meal.meal_index} · ${time} · ${Math.round(mealCal)} kcal`);
      for (const item of meal.meal_items ?? []) {
        const qty = item.amount_g ? `${item.amount_g}g` : item.portion_desc;
        lines.push(`- ${item.food_name} (${qty}) — ${Math.round(item.calories)} kcal`);
      }
      if (meal.notes) lines.push(`> ${meal.notes}`);
      lines.push("");
    }
  }

  if ((metricsRes.data ?? []).length > 0) {
    lines.push("## Body Metrics", "");
    lines.push("| Date | Weight (kg) | Body Fat (%) |");
    lines.push("|------|-------------|--------------|");
    for (const m of metricsRes.data ?? []) {
      lines.push(`| ${m.recorded_at.split("T")[0]} | ${m.weight_kg ?? "—"} | ${m.body_fat_pct ?? "—"} |`);
    }
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="nutrition-export.md"`,
    },
  });
});
```

- [ ] **Step 2: Verify the file exists**

```bash
ls supabase/functions/export/index.ts
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/export/index.ts
git commit -m "feat: add export edge function (markdown + csv)"
```

---

## Task 3: Deploy Edge Functions & Set Secret

**Files:** (no source files, infra steps only)

- [ ] **Step 1: Set the Gemini API key secret**

```bash
supabase secrets set GEMINI_API_KEY=<your_key_here>
```

Expected output: `Finished supabase secrets set.`

- [ ] **Step 2: Deploy the gemini function**

```bash
supabase functions deploy gemini
```

Expected: `Deployed Functions gemini` (no errors).

- [ ] **Step 3: Deploy the export function**

```bash
supabase functions deploy export
```

Expected: `Deployed Functions export` (no errors).

- [ ] **Step 4: Smoke-test gemini (curl)**

Replace `<SUPABASE_URL>`, `<ANON_KEY>`, and `<USER_JWT>` with real values from `.env.local` and a signed-in session token.

```bash
curl -X POST "<SUPABASE_URL>/functions/v1/gemini" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"question":"What did I eat yesterday?","window_days":2}' \
  --no-buffer
```

Expected: streaming text response (may be "no data" if DB is empty — that's fine).

- [ ] **Step 5: Smoke-test export (curl)**

```bash
curl -X POST "<SUPABASE_URL>/functions/v1/export" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","days":7}'
```

Expected: CSV text with header row.

---

## Task 4: Mobile Gemini Helper (`lib/gemini.ts`)

**Files:**
- Create: `lib/gemini.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/gemini.ts
import { supabase } from "./supabase";

const EDGE_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/gemini`;

export async function streamGeminiResponse(
  question: string,
  windowDays = 14,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    onError(new Error("Not authenticated"));
    return;
  }

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
    onComplete();
  } catch {
    onError(new Error("Stream interrupted"));
  }
}

export async function triggerExport(
  format: "markdown" | "csv",
  days = 30
): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/export`;
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
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors involving `lib/gemini.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/gemini.ts
git commit -m "feat: add mobile gemini/export helper"
```

---

## Task 5: Chat Hook (`hooks/useGeminiChat.ts`)

**Files:**
- Create: `hooks/useGeminiChat.ts`

- [ ] **Step 1: Create the file**

```typescript
// hooks/useGeminiChat.ts
import { useState, useCallback } from "react";
import { streamGeminiResponse } from "@/lib/gemini";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

export function useGeminiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (question: string) => {
    if (isStreaming) return;
    setError(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: question,
    };

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    await streamGeminiResponse(
      question,
      14,
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      () => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false };
          }
          return updated;
        });
        setIsStreaming(false);
      },
      (err) => {
        setError(err.message);
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant" && last.content === "") {
            updated.pop();
          }
          return updated;
        });
        setIsStreaming(false);
      }
    );
  }, [isStreaming]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, sendMessage, clearMessages };
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors involving `hooks/useGeminiChat.ts`.

- [ ] **Step 3: Commit**

```bash
git add hooks/useGeminiChat.ts
git commit -m "feat: add useGeminiChat hook"
```

---

## Task 6: Quick Prompts Constant (`constants/prompts.ts`)

**Files:**
- Create: `constants/prompts.ts`

- [ ] **Step 1: Create the file**

```typescript
// constants/prompts.ts
export const QUICK_PROMPTS = [
  "Summarise my nutrition for the past 7 days.",
  "What was my average daily protein this week?",
  "How consistent have I been with my 16:8 fasting?",
  "On which days did I overeat compared to my usual pattern?",
  "How has my weight trended over the past 30 days?",
] as const;
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add constants/prompts.ts
git commit -m "feat: add quick prompts constants"
```

---

## Task 7: Install `expo-file-system` and `expo-sharing`

**Files:** `package.json` (updated by expo install)

- [ ] **Step 1: Install the packages**

```bash
npx expo install expo-file-system expo-sharing
```

Expected: packages added to `package.json` dependencies with Expo-compatible versions.

- [ ] **Step 2: Verify entries in package.json**

```bash
grep -E "expo-file-system|expo-sharing" package.json
```

Expected: both packages listed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install expo-file-system and expo-sharing"
```

---

## Task 8: Insights Screen — Chat UI (`app/(tabs)/insights.tsx`)

**Files:**
- Modify: `app/(tabs)/insights.tsx`

- [ ] **Step 1: Replace the placeholder with the full chat screen**

```typescript
// app/(tabs)/insights.tsx
import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGeminiChat, type ChatMessage } from '../../hooks/useGeminiChat';
import { QUICK_PROMPTS } from '../../constants/prompts';

// ── Animated dots for streaming placeholder ──────────────────────────────────

function StreamingDots() {
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#6b7280',
            opacity: 0.6,
          }}
        />
      ))}
    </View>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View
      style={{
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
        marginHorizontal: 16,
      }}
    >
      <View
        style={{
          maxWidth: '82%',
          backgroundColor: isUser ? '#16a34a' : '#111827',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        {message.isStreaming && message.content === '' ? (
          <StreamingDots />
        ) : (
          <Text style={{ color: isUser ? '#ffffff' : '#d1d5db', fontSize: 15, lineHeight: 22 }}>
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#450a0a',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: '#fca5a5', fontSize: 13, flex: 1 }}>{message}</Text>
      <Pressable onPress={onDismiss} style={{ marginLeft: 8 }}>
        <Text style={{ color: '#f87171', fontSize: 16, fontWeight: '700' }}>✕</Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useGeminiChat();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  function handleSend() {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText('');
    void sendMessage(text);
  }

  function handleQuickPrompt(prompt: string) {
    setInputText(prompt);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030712' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700' }}>Insights</Text>
        {messages.length > 0 ? (
          <Pressable onPress={clearMessages}>
            <Text style={{ color: '#6b7280', fontSize: 14 }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#374151', fontSize: 14 }}>Ask anything about your nutrition data.</Text>
          </View>
        }
      />

      {/* Error banner */}
      {error ? (
        <ErrorBanner
          message={error}
          onDismiss={() => {
            // clearMessages clears error too; use sendMessage's error setter directly isn't exposed,
            // so we call clearMessages only if no messages, otherwise just re-render without it.
            // Since useGeminiChat exposes clearMessages which resets error, we use that pattern:
            clearMessages();
          }}
        />
      ) : null}

      {/* Quick prompts — shown only when no messages */}
      {messages.length === 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
        >
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => handleQuickPrompt(prompt)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1f2937' : '#111827',
                borderWidth: 1,
                borderColor: '#374151',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
              })}
            >
              <Text style={{ color: '#9ca3af', fontSize: 13 }}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Input row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          paddingBottom: 12,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#1f2937',
          gap: 10,
        }}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask anything..."
          placeholderTextColor="#4b5563"
          multiline
          numberOfLines={1}
          style={{
            flex: 1,
            backgroundColor: '#111827',
            color: '#ffffff',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            maxHeight: 100,
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isStreaming}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor:
              !inputText.trim() || isStreaming ? '#1f2937' : pressed ? '#16a34a' : '#22c55e',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {isStreaming ? (
            <ActivityIndicator size="small" color="#6b7280" />
          ) : (
            <Text style={{ color: !inputText.trim() ? '#6b7280' : '#000000', fontSize: 18, fontWeight: '700' }}>
              ↑
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors involving `app/(tabs)/insights.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/insights.tsx
git commit -m "feat: implement insights chat screen with streaming UI"
```

---

## Task 9: Profile Screen — Wire Up Export Buttons

**Files:**
- Modify: `app/(tabs)/profile.tsx`

Note: The `ExportSection` function currently renders disabled placeholder buttons. Replace it entirely with the implementation below. All other functions in `profile.tsx` remain unchanged.

- [ ] **Step 1: Add imports at the top of `profile.tsx`**

After the existing import block (after line `import type { NotificationConfig } from '../../constants/notifications';`), add:

```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { triggerExport } from '../../lib/gemini';
```

- [ ] **Step 2: Replace the `ExportSection` function**

Find and replace the entire `ExportSection` function (from `function ExportSection()` through its closing `}`):

```typescript
// ── Section 5: Export ─────────────────────────────────────────────────────────

function ExportSection() {
  const [exportingMd, setExportingMd] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function handleExport(format: 'markdown' | 'csv') {
    const setExporting = format === 'markdown' ? setExportingMd : setExportingCsv;
    const filename = format === 'markdown' ? 'nutrition-export.md' : 'nutrition-export.csv';
    const mimeType = format === 'markdown' ? 'text/markdown' : 'text/csv';

    setExporting(true);
    try {
      const blob = await triggerExport(format, 30);
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // result is "data:<mime>;base64,<data>"
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const fileUri = (FileSystem.cacheDirectory ?? '') + filename;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, { mimeType, UTI: mimeType });
    } catch (err) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <SectionHeader title="Export" />
      <Card>
        <Pressable
          onPress={() => { void handleExport('markdown'); }}
          disabled={exportingMd || exportingCsv}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: exportingMd ? '#22c55e' : '#374151',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
            marginBottom: 8,
            opacity: exportingCsv ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          {exportingMd ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>Export Markdown</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => { void handleExport('csv'); }}
          disabled={exportingMd || exportingCsv}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: exportingCsv ? '#22c55e' : '#374151',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: exportingMd ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          {exportingCsv ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>Export CSV</Text>
          )}
        </Pressable>
      </Card>
    </>
  );
}
```

- [ ] **Step 3: Add `ActivityIndicator` to the existing React Native import in `profile.tsx`**

The top of `profile.tsx` already imports from `'react-native'`. Add `ActivityIndicator` to that import list if not already present:

```typescript
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat: wire up export buttons with file system and share sheet"
```

---

## Task 10: Final TypeScript & Acceptance Verification

**Files:** (no changes, verification only)

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Verify all new files exist**

```bash
ls supabase/functions/gemini/index.ts \
   supabase/functions/export/index.ts \
   lib/gemini.ts \
   hooks/useGeminiChat.ts \
   constants/prompts.ts
```

Expected: all five files listed without error.

- [ ] **Step 3: Manual acceptance checklist**

Test on device/simulator:

- [ ] Insights screen loads and shows quick prompt chips
- [ ] Tapping a chip populates the input (does not auto-send)
- [ ] Typing a question and tapping send shows a streaming response
- [ ] Response begins appearing within 5 seconds
- [ ] Sending same question twice within 1 hour: check network log for `X-Cache: HIT`
- [ ] Clear button removes all messages
- [ ] Turn off WiFi, send a message → error banner appears
- [ ] Profile → Export Markdown → native share sheet opens with `.md` file
- [ ] Profile → Export CSV → native share sheet opens with `.csv` file

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: phase 3 complete — ai chat and export"
```
