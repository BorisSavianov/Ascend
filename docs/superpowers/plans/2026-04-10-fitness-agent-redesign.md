# Fitness Agent Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Insights tab into a persistent, multi-domain fitness assistant with hybrid agent routing (simple enriched call or tool-loop), cross-session conversation history, and twice-weekly proactive insights delivered via push notification.

**Architecture:** New `fitness-agent` Supabase Edge Function with a 3-second-timeout classifier that routes to either an enriched single-call path or a tool-loop agent (max 3 iterations). Conversation history persisted in `ai_threads`/`ai_messages` Supabase tables, mirrored in AsyncStorage for instant load. A separate `proactive` Edge Function runs via pg_cron Monday + Thursday. `useConversation` hook replaces `useGeminiChat`. Old `/gemini` Edge Function stays deployed but is no longer called from the client.

**Tech Stack:** Deno/TypeScript (Edge Functions), `@google/generative-ai` npm, Supabase (Postgres + Edge Functions + pg_cron), React Native + Expo SDK 52, `react-native-markdown-display` (new), `expo-notifications` (existing), `@react-native-async-storage/async-storage` (existing), TanStack Query, Zustand.

**Spec:** `docs/superpowers/specs/2026-04-10-fitness-agent-redesign.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/011_fitness_agent.sql` | Create | New tables, RLS policies, `assemble_full_context` SQL function |
| `supabase/functions/fitness-agent/index.ts` | Create | Entry point: auth, classify, route, stream, persist |
| `supabase/functions/fitness-agent/classifier.ts` | Create | 3s-timeout Gemini routing call |
| `supabase/functions/fitness-agent/prompts.ts` | Create | Dynamic system prompt builder |
| `supabase/functions/fitness-agent/tools.ts` | Create | 5 tool declarations + SQL implementations |
| `supabase/functions/fitness-agent/simple.ts` | Create | Enriched single-call path with keyword gating |
| `supabase/functions/fitness-agent/loop.ts` | Create | Tool-loop agent path, max 3 iterations |
| `supabase/functions/proactive/index.ts` | Create | Weekly cron: 7-day summary → Gemini → push notification |
| `types/conversation.ts` | Create | `LocalThread`, `LocalMessage`, `ThreadIndexEntry` types |
| `hooks/useConversation.ts` | Create | Thread lifecycle, AsyncStorage/Supabase sync, send |
| `hooks/usePushToken.ts` | Create | Register Expo push token on mount, upsert to DB |
| `hooks/useProactiveInsight.ts` | Create | Query latest unread proactive insight on screen focus |
| `components/ProactiveInsightBanner.tsx` | Create | Dismissable insight card with "Ask about this" |
| `components/PathBadge.tsx` | Create | `· reasoned with tools` label for complex-path messages |
| `components/ThreadSheet.tsx` | Create | Modal thread list: switch, new thread, delete |
| `types/database.ts` | Modify | Add row types for 4 new tables |
| `lib/gemini.ts` | Modify | Add `sendMessage()` targeting `/fitness-agent` |
| `constants/prompts.ts` | Modify | 9 prompts across 3 domains |
| `app/(tabs)/insights.tsx` | Modify | Full redesign using `useConversation` |

---

## Phase 1 — Foundation

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/011_fitness_agent.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/011_fitness_agent.sql

-- ── Conversation threads ──────────────────────────────────────────────────────
CREATE TABLE ai_threads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title        TEXT,
  summary      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_active  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ai_threads_user_active ON ai_threads (user_id, last_active DESC);

ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_threads_owner ON ai_threads
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Messages within threads ───────────────────────────────────────────────────
CREATE TABLE ai_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    UUID NOT NULL REFERENCES ai_threads ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  path         TEXT CHECK (path IN ('simple', 'complex')),
  tokens_used  INTEGER,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ai_messages_thread ON ai_messages (thread_id, created_at ASC);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_messages_owner ON ai_messages
  USING (
    EXISTS (
      SELECT 1 FROM ai_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- ── Proactive insights from cron ─────────────────────────────────────────────
CREATE TABLE ai_proactive_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content      TEXT NOT NULL,
  category     TEXT CHECK (category IN ('nutrition','training','body_comp','fasting')),
  read         BOOLEAN DEFAULT false,
  notified     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_proactive_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_proactive_owner ON ai_proactive_insights
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Push notification tokens ──────────────────────────────────────────────────
CREATE TABLE user_push_tokens (
  user_id     UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  expo_token  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_token_owner ON user_push_tokens
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── assemble_full_context (replaces assemble_ai_context) ─────────────────────
-- Note: assemble_ai_context is NOT dropped — the old /gemini function still uses it.
CREATE OR REPLACE FUNCTION assemble_full_context(
  p_user_id        UUID,
  p_window_days    INTEGER DEFAULT 14,
  p_calorie_target INTEGER DEFAULT NULL,
  p_macro_targets  JSONB DEFAULT NULL,
  p_fasting_target INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE SQL
STABLE
AS $$
  SELECT json_build_object(
    'generated_at', now(),
    'window_days',  p_window_days,

    'user_targets', json_build_object(
      'calorie_target',       p_calorie_target,
      'macro_targets',        p_macro_targets,
      'fasting_target_hours', p_fasting_target
    ),

    'daily_totals', (
      SELECT json_agg(json_build_object(
        'date',      log_date,
        'calories',  total_calories,
        'protein_g', total_protein_g,
        'fat_g',     total_fat_g,
        'carbs_g',   total_carbs_g,
        'fiber_g',   total_fiber_g,
        'meals',     meal_count
      ) ORDER BY log_date DESC)
      FROM daily_summaries
      WHERE user_id = p_user_id
        AND log_date >= now() - (p_window_days || ' days')::INTERVAL
    ),

    'meals', (
      SELECT json_agg(meal_obj ORDER BY (meal_obj->>'logged_at') DESC)
      FROM (
        SELECT json_build_object(
          'date',          DATE(m.logged_at),
          'time',          TO_CHAR(m.logged_at, 'HH24:MI'),
          'label',         m.meal_label,
          'notes',         m.notes,
          'meal_calories', (
            SELECT ROUND(SUM(calories)::NUMERIC, 1)
            FROM meal_items WHERE meal_id = m.id
          ),
          'meal_protein', (
            SELECT ROUND(SUM(protein_g)::NUMERIC, 1)
            FROM meal_items WHERE meal_id = m.id
          ),
          'items', (
            SELECT json_agg(json_build_object(
              'food',      mi.food_name,
              'food_bg',   mi.food_name_local,
              'amount_g',  mi.amount_g,
              'portion',   mi.portion_desc,
              'calories',  mi.calories,
              'protein_g', mi.protein_g,
              'fat_g',     mi.fat_g,
              'carbs_g',   mi.carbs_g,
              'fiber_g',   mi.fiber_g
            ))
            FROM meal_items mi WHERE mi.meal_id = m.id
          )
        ) AS meal_obj
        FROM meals m
        WHERE m.user_id = p_user_id
          AND m.logged_at >= now() - (p_window_days || ' days')::INTERVAL
      ) sub
    ),

    'workout_sessions', (
      SELECT json_agg(json_build_object(
        'date',      ws.date,
        'day_name',  wd.name,
        'started_at', ws.started_at,
        'ended_at',  ws.ended_at,
        'notes',     ws.notes,
        'exercises', (
          SELECT json_agg(json_build_object(
            'name',         et.name,
            'muscle_group', et.muscle_group,
            'sets', (
              SELECT json_agg(json_build_object(
                'set_number', ls.set_number,
                'weight_kg',  ls.weight_kg,
                'reps',       ls.reps,
                'rpe',        ls.rpe,
                'completed',  ls.is_completed
              ) ORDER BY ls.set_number)
              FROM logged_sets ls
              WHERE ls.logged_exercise_id = le.id
            )
          ))
          FROM logged_exercises le
          JOIN exercise_templates et ON et.id = le.exercise_template_id
          WHERE le.session_id = ws.id
        )
      ) ORDER BY ws.date DESC)
      FROM workout_sessions ws
      JOIN workout_days wd ON wd.id = ws.workout_day_id
      WHERE ws.user_id = p_user_id
        AND ws.date >= (now() - (p_window_days || ' days')::INTERVAL)::DATE
    ),

    'body_metrics', (
      SELECT json_agg(json_build_object(
        'date',         DATE(recorded_at),
        'weight_kg',    weight_kg,
        'body_fat_pct', body_fat_pct,
        'notes',        notes
      ) ORDER BY recorded_at DESC)
      FROM (
        SELECT * FROM body_metrics
        WHERE user_id = p_user_id
          AND recorded_at >= now() - '30 days'::INTERVAL
        ORDER BY recorded_at DESC
        LIMIT 10
      ) bm_limited
    ),

    'fasting_logs', (
      SELECT json_agg(json_build_object(
        'started',      started_at,
        'ended',        ended_at,
        'target_hours', target_hours,
        'actual_hours', actual_hours,
        'completed',    completed
      ) ORDER BY started_at DESC)
      FROM fasting_logs
      WHERE user_id = p_user_id
        AND started_at >= now() - (p_window_days || ' days')::INTERVAL
    )
  );
$$;
```

- [ ] **Step 2: Apply migration via Supabase dashboard or CLI**

```bash
# If using Supabase CLI:
supabase db push
# Or paste the SQL directly into the Supabase dashboard SQL editor.
```

Expected: No errors. Four new tables visible in Table Editor. `assemble_full_context` visible under Database → Functions.

- [ ] **Step 3: Verify RLS in Supabase dashboard**

Navigate to Authentication → Policies. Confirm policies exist for `ai_threads`, `ai_messages`, `ai_proactive_insights`, `user_push_tokens`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_fitness_agent.sql
git commit -m "feat: add fitness agent DB schema and assemble_full_context function"
```

---

### Task 2: TypeScript Database Types

**Files:**
- Modify: `types/database.ts` (append before the closing of the `Tables` block and add convenience exports at the bottom)

- [ ] **Step 1: Add new table rows to the `Tables` block**

In `types/database.ts`, inside the `public: { Tables: { ... } }` block, add after the `workout_sessions` entry:

```typescript
      ai_threads: {
        Row: {
          id: string
          user_id: string
          title: string | null
          summary: string | null
          created_at: string
          last_active: string
        }
        Insert: {
          id?: string
          user_id?: string
          title?: string | null
          summary?: string | null
          created_at?: string
          last_active?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          summary?: string | null
          created_at?: string
          last_active?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          id: string
          thread_id: string
          role: string
          content: string
          path: string | null
          tokens_used: number | null
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          role: string
          content: string
          path?: string | null
          tokens_used?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          role?: string
          content?: string
          path?: string | null
          tokens_used?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_proactive_insights: {
        Row: {
          id: string
          user_id: string
          content: string
          category: string | null
          read: boolean
          notified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          content: string
          category?: string | null
          read?: boolean
          notified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          category?: string | null
          read?: boolean
          notified?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_push_tokens: {
        Row: {
          user_id: string
          expo_token: string
          updated_at: string
        }
        Insert: {
          user_id?: string
          expo_token: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          expo_token?: string
          updated_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Add convenience type exports at the bottom of the file**

Append after the existing `export type FastingLog = ...` line:

```typescript
export type AiThreadRow = Database['public']['Tables']['ai_threads']['Row'];
export type AiMessageRow = Database['public']['Tables']['ai_messages']['Row'];
export type AiProactiveInsightRow = Database['public']['Tables']['ai_proactive_insights']['Row'];
export type UserPushTokenRow = Database['public']['Tables']['user_push_tokens']['Row'];
```

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat: add TypeScript types for fitness agent tables"
```

---

### Task 3: Local Conversation Types

**Files:**
- Create: `types/conversation.ts`

- [ ] **Step 1: Create the file**

```typescript
// types/conversation.ts

export type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  path?: 'simple' | 'complex';
  createdAt: string; // ISO string
};

export type LocalThread = {
  id: string;
  title: string | null;
  lastActive: string; // ISO string
  messages: LocalMessage[]; // last 30 messages cached
};

export type ThreadIndexEntry = {
  id: string;
  title: string | null;
  lastActive: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add types/conversation.ts
git commit -m "feat: add local conversation types for AsyncStorage thread mirror"
```

---

### Task 4: useConversation Hook

**Files:**
- Create: `hooks/useConversation.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useConversation.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { sendMessage as apiSendMessage } from '../lib/gemini';
import { useAppStore } from '../store/useAppStore';
import type { LocalThread, LocalMessage, ThreadIndexEntry } from '../types/conversation';

const ACTIVE_THREAD_KEY = '@ai_active_thread';
const THREAD_INDEX_KEY = '@ai_thread_index';
const threadKey = (id: string) => `@ai_thread_${id}`;
const MAX_LOCAL_THREADS = 10;
const MAX_LOCAL_MESSAGES = 30;

export function useConversation(windowDays: number) {
  const [thread, setThread] = useState<LocalThread | null>(null);
  const [threadIndex, setThreadIndex] = useState<ThreadIndexEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStreamingRef = useRef(false);
  const pendingChunkRef = useRef('');
  const rafHandleRef = useRef<number | null>(null);

  const calorieTarget = useAppStore((s) => s.calorieTarget);
  const macroTargets = useAppStore((s) => s.macroTargets);
  const fastingTargetHours = useAppStore((s) => s.fastingTargetHours);

  useEffect(() => {
    void loadActiveThread();
    return () => {
      if (rafHandleRef.current !== null) cancelAnimationFrame(rafHandleRef.current);
    };
  }, []);

  async function loadActiveThread() {
    try {
      const [activeId, indexStr] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_THREAD_KEY),
        AsyncStorage.getItem(THREAD_INDEX_KEY),
      ]);
      if (indexStr) setThreadIndex(JSON.parse(indexStr));
      if (activeId) {
        const stored = await AsyncStorage.getItem(threadKey(activeId));
        if (stored) {
          setThread(JSON.parse(stored));
          void syncThreadFromSupabase(activeId);
          return;
        }
      }
    } catch { /* fall through to create */ }
    await createNewThread();
  }

  async function syncThreadFromSupabase(threadId: string) {
    const [messagesRes, threadRes] = await Promise.all([
      supabase
        .from('ai_messages')
        .select('id, role, content, path, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(MAX_LOCAL_MESSAGES),
      supabase
        .from('ai_threads')
        .select('id, title, last_active')
        .eq('id', threadId)
        .maybeSingle(),
    ]);
    if (!threadRes.data) return;

    const synced: LocalThread = {
      id: threadRes.data.id,
      title: threadRes.data.title,
      lastActive: threadRes.data.last_active,
      messages: (messagesRes.data ?? []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        path: (m.path ?? undefined) as 'simple' | 'complex' | undefined,
        createdAt: m.created_at,
      })),
    };
    await AsyncStorage.setItem(threadKey(threadId), JSON.stringify(synced));
    setThread(synced);
    await updateThreadIndex({ id: synced.id, title: synced.title, lastActive: synced.lastActive });
  }

  async function updateThreadIndex(entry: ThreadIndexEntry) {
    const indexStr = await AsyncStorage.getItem(THREAD_INDEX_KEY);
    const index: ThreadIndexEntry[] = indexStr ? JSON.parse(indexStr) : [];
    const filtered = index.filter((e) => e.id !== entry.id);
    const updated = [entry, ...filtered];
    await AsyncStorage.setItem(THREAD_INDEX_KEY, JSON.stringify(updated));
    setThreadIndex(updated);
  }

  const createNewThread = useCallback(async () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newThread: LocalThread = { id, title: null, lastActive: now, messages: [] };

    const indexStr = await AsyncStorage.getItem(THREAD_INDEX_KEY);
    const index: ThreadIndexEntry[] = indexStr ? JSON.parse(indexStr) : [];
    if (index.length >= MAX_LOCAL_THREADS) {
      const oldest = index[index.length - 1];
      await AsyncStorage.removeItem(threadKey(oldest.id));
      index.pop();
    }
    const updated = [{ id, title: null, lastActive: now }, ...index];
    await Promise.all([
      AsyncStorage.setItem(THREAD_INDEX_KEY, JSON.stringify(updated)),
      AsyncStorage.setItem(threadKey(id), JSON.stringify(newThread)),
      AsyncStorage.setItem(ACTIVE_THREAD_KEY, id),
    ]);
    setThreadIndex(updated);
    setThread(newThread);
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    await AsyncStorage.setItem(ACTIVE_THREAD_KEY, threadId);
    const stored = await AsyncStorage.getItem(threadKey(threadId));
    if (stored) {
      setThread(JSON.parse(stored));
    }
    void syncThreadFromSupabase(threadId);
  }, []);

  const deleteThread = useCallback(async (threadId: string) => {
    await AsyncStorage.removeItem(threadKey(threadId));
    const indexStr = await AsyncStorage.getItem(THREAD_INDEX_KEY);
    const index: ThreadIndexEntry[] = indexStr ? JSON.parse(indexStr) : [];
    const updated = index.filter((e) => e.id !== threadId);
    await AsyncStorage.setItem(THREAD_INDEX_KEY, JSON.stringify(updated));
    setThreadIndex(updated);
    // Delete from Supabase (cascade deletes messages)
    await supabase.from('ai_threads').delete().eq('id', threadId);
    // If we deleted the active thread, create a new one
    const activeId = await AsyncStorage.getItem(ACTIVE_THREAD_KEY);
    if (activeId === threadId) {
      if (updated.length > 0) {
        await loadThread(updated[0].id);
      } else {
        await createNewThread();
      }
    }
  }, [createNewThread, loadThread]);

  const sendMessage = useCallback(async (question: string) => {
    if (isStreamingRef.current || !thread) return;
    setError(null);

    const userMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    const optimisticThread: LocalThread = {
      ...thread,
      lastActive: new Date().toISOString(),
      messages: [...thread.messages, userMsg, assistantMsg],
    };
    setThread(optimisticThread);
    await AsyncStorage.setItem(threadKey(thread.id), JSON.stringify(optimisticThread));

    isStreamingRef.current = true;
    setIsStreaming(true);

    function flushPendingChunk() {
      const chunk = pendingChunkRef.current;
      if (!chunk) return;
      pendingChunkRef.current = '';
      rafHandleRef.current = null;
      setThread((prev) => {
        if (!prev) return prev;
        const msgs = [...prev.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
        }
        return { ...prev, messages: msgs };
      });
    }

    await apiSendMessage({
      threadId: thread.id,
      message: question,
      windowDays,
      userTargets: { calorieTarget, macroTargets, fastingTargetHours },
      onChunk: (chunk) => {
        pendingChunkRef.current += chunk;
        if (rafHandleRef.current === null) {
          rafHandleRef.current = requestAnimationFrame(flushPendingChunk);
        }
      },
      onComplete: (path) => {
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        const remaining = pendingChunkRef.current;
        pendingChunkRef.current = '';
        setThread((prev) => {
          if (!prev) return prev;
          const msgs = [...prev.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: last.content + remaining, path };
          }
          const next = { ...prev, messages: msgs };
          void AsyncStorage.setItem(threadKey(prev.id), JSON.stringify(next));
          return next;
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
        // Sync title from Supabase (Edge Function sets it on first message)
        void syncThreadTitleFromSupabase(thread.id);
      },
      onError: (err) => {
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        pendingChunkRef.current = '';
        setError(err.message);
        setThread((prev) => {
          if (!prev) return prev;
          const msgs = [...prev.messages];
          if (msgs[msgs.length - 1]?.role === 'assistant') msgs.pop();
          return { ...prev, messages: msgs };
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
      },
    });
  }, [thread, windowDays, calorieTarget, macroTargets, fastingTargetHours]);

  async function syncThreadTitleFromSupabase(threadId: string) {
    const { data } = await supabase
      .from('ai_threads')
      .select('title')
      .eq('id', threadId)
      .maybeSingle();
    if (data?.title) {
      setThread((prev) => (prev ? { ...prev, title: data.title } : prev));
      await updateThreadIndex({
        id: threadId,
        title: data.title,
        lastActive: new Date().toISOString(),
      });
    }
  }

  const clearError = useCallback(() => setError(null), []);

  return {
    thread,
    messages: thread?.messages ?? [],
    isStreaming,
    error,
    threadIndex,
    sendMessage,
    createNewThread,
    loadThread,
    deleteThread,
    clearError,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useConversation.ts
git commit -m "feat: add useConversation hook with AsyncStorage/Supabase dual persistence"
```

---

### Task 5: Markdown Renderer

**Files:**
- Modify: `app/(tabs)/insights.tsx` (ChatBubble component only)

- [ ] **Step 1: Install react-native-markdown-display**

```bash
npx expo install react-native-markdown-display
```

Expected: Package added to `node_modules` and `package.json`.

- [ ] **Step 2: Update `ChatBubble` in `app/(tabs)/insights.tsx`**

Add import at the top of the file:

```typescript
import Markdown from 'react-native-markdown-display';
```

Replace the `ChatBubble` component body. Find:

```typescript
        {message.isStreaming && message.content === '' ? (
          <StreamingDots />
        ) : (
          <Text
            style={[
              typography.bodySm,
              {
                color: colors.text.primary,
              },
            ]}
          >
            {message.content}
          </Text>
        )}
```

Replace with:

```typescript
        {message.isStreaming && message.content === '' ? (
          <StreamingDots />
        ) : (
          <Markdown
            style={{
              body: { ...typography.bodySm, color: colors.text.primary, margin: 0 },
              paragraph: { marginTop: 0, marginBottom: 4 },
              strong: { fontWeight: '700' },
              bullet_list: { marginVertical: 4 },
              ordered_list: { marginVertical: 4 },
            }}
          >
            {message.content}
          </Markdown>
        )}
```

- [ ] **Step 3: Verify rendering**

Run the app. Navigate to Insights. Send a test message with markdown (e.g. "test **bold** and bullet: - item"). Confirm formatting renders.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/insights.tsx package.json
git commit -m "feat: render markdown in assistant chat bubbles"
```

---

## Phase 2 — Agent Core

### Task 6: Dynamic System Prompt Builder

**Files:**
- Create: `supabase/functions/fitness-agent/prompts.ts`

- [ ] **Step 1: Create the file**

```typescript
// supabase/functions/fitness-agent/prompts.ts

export type UserTargets = {
  calorieTarget: number | null;
  macroTargets: { protein: number; fat: number; carbs: number } | null;
  fastingTargetHours: number | null;
};

export function buildSystemPrompt(targets: UserTargets): string {
  const calLine = targets.calorieTarget
    ? `User targets: ${targets.calorieTarget} kcal/day`
    : 'User calorie target: not set';

  const macroLine = targets.macroTargets
    ? `Macros: ${targets.macroTargets.protein}g protein / ${targets.macroTargets.fat}g fat / ${targets.macroTargets.carbs}g carbs`
    : 'Macro targets: not set';

  const fastLine = targets.fastingTargetHours
    ? `Fasting protocol: ${targets.fastingTargetHours}h target window`
    : 'Fasting protocol: not set';

  return `You are a personal fitness assistant for a single user.
Your domain covers nutrition, resistance training, body composition, and intermittent fasting.
You reason across all domains together.

${calLine}
${macroLine}
${fastLine}
Diet style: primarily meat-based, Bulgarian dairy (kashkaval, kiselo mlyako)
Logging precision: portion estimates (±15%) — treat gram weights as approximations
Language: respond in the same language the user writes in

- Be analytically direct. No moralising, no hedging.
- Reference specific dates when making trend claims.
- When data is missing, state exactly what is missing.
- Do not repeat raw numbers back — interpret and summarise.
- For training data: comment on progressive overload and recovery signals.
- Cross-domain observations (e.g. low protein on training days) are high value — prioritise them.`.trim();
}

export const CLASSIFIER_PROMPT = `You are a question router. Classify the user's fitness question.
Reply with ONLY one word:
- "simple"  — single domain, one time period, no cross-referencing needed
- "complex" — crosses domains (nutrition + training), requires temporal comparison, trend correlation, or anomaly detection`.trim();

export const PROACTIVE_PROMPT = `You are a fitness analyst reviewing one week of data for a single user.
Identify the single most actionable observation — something specific, data-backed, and non-obvious.
It must be something the user can act on this week. One paragraph, no greeting, no sign-off.
Categories to consider: nutrition adherence, training progression, body composition trend, fasting consistency, cross-domain pattern.`.trim();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fitness-agent/prompts.ts
git commit -m "feat: add dynamic system prompt builder for fitness agent"
```

---

### Task 7: Classifier

**Files:**
- Create: `supabase/functions/fitness-agent/classifier.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fitness-agent/classifier.ts
git commit -m "feat: add 3-second-timeout classifier for agent routing"
```

---

### Task 8: Tool Definitions and SQL Implementations

**Files:**
- Create: `supabase/functions/fitness-agent/tools.ts`

- [ ] **Step 1: Create the file**

```typescript
// supabase/functions/fitness-agent/tools.ts
import { type SupabaseClient } from "npm:@supabase/supabase-js";

export const TOOL_DECLARATIONS = [
  {
    name: "get_nutrition",
    description: "Get daily nutrition totals for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_workouts",
    description: "Get workout sessions with exercises and sets for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_body_metrics",
    description: "Get weight and body fat readings for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_fasting",
    description: "Get fasting log entries for the last N days",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "compute_trends",
    description: "Compare average calories, protein, or weight between two date ranges",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["calories", "protein", "weight"],
          description: "The metric to compare",
        },
        period_a_from: { type: "string", description: "Period A start date YYYY-MM-DD" },
        period_a_to:   { type: "string", description: "Period A end date YYYY-MM-DD" },
        period_b_from: { type: "string", description: "Period B start date YYYY-MM-DD" },
        period_b_to:   { type: "string", description: "Period B end date YYYY-MM-DD" },
      },
      required: ["metric", "period_a_from", "period_a_to", "period_b_from", "period_b_to"],
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case "get_nutrition": {
      const days = Math.min(Math.max(1, Number(args.days) || 14), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("daily_summaries")
        .select("log_date,total_calories,total_protein_g,total_fat_g,total_carbs_g,total_fiber_g,meal_count")
        .eq("user_id", userId)
        .gte("log_date", since)
        .order("log_date", { ascending: false });
      return data ?? [];
    }

    case "get_workouts": {
      const days = Math.min(Math.max(1, Number(args.days) || 14), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("workout_sessions")
        .select(`
          date, started_at, ended_at, notes,
          workout_days ( name ),
          logged_exercises (
            exercise_templates ( name, muscle_group ),
            logged_sets ( set_number, weight_kg, reps, rpe, is_completed )
          )
        `)
        .eq("user_id", userId)
        .gte("date", since)
        .order("date", { ascending: false });
      return data ?? [];
    }

    case "get_body_metrics": {
      const days = Math.min(Math.max(1, Number(args.days) || 30), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await supabase
        .from("body_metrics")
        .select("recorded_at,weight_kg,body_fat_pct,notes")
        .eq("user_id", userId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(10);
      return data ?? [];
    }

    case "get_fasting": {
      const days = Math.min(Math.max(1, Number(args.days) || 14), 90);
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await supabase
        .from("fasting_logs")
        .select("started_at,ended_at,target_hours,actual_hours,completed")
        .eq("user_id", userId)
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      return data ?? [];
    }

    case "compute_trends": {
      const metric = String(args.metric);
      if (metric === "calories" || metric === "protein") {
        const col = metric === "calories" ? "total_calories" : "total_protein_g";
        const [resA, resB] = await Promise.all([
          supabase
            .from("daily_summaries")
            .select(col)
            .eq("user_id", userId)
            .gte("log_date", String(args.period_a_from))
            .lte("log_date", String(args.period_a_to)),
          supabase
            .from("daily_summaries")
            .select(col)
            .eq("user_id", userId)
            .gte("log_date", String(args.period_b_from))
            .lte("log_date", String(args.period_b_to)),
        ]);
        const avg = (rows: Record<string, number>[], c: string) =>
          rows.length
            ? Math.round(rows.reduce((s, r) => s + (r[c] ?? 0), 0) / rows.length)
            : null;
        return {
          metric,
          period_a: {
            from: args.period_a_from,
            to: args.period_a_to,
            avg: avg((resA.data ?? []) as Record<string, number>[], col),
          },
          period_b: {
            from: args.period_b_from,
            to: args.period_b_to,
            avg: avg((resB.data ?? []) as Record<string, number>[], col),
          },
        };
      }
      if (metric === "weight") {
        const [resA, resB] = await Promise.all([
          supabase
            .from("body_metrics")
            .select("weight_kg")
            .eq("user_id", userId)
            .gte("recorded_at", String(args.period_a_from))
            .lte("recorded_at", String(args.period_a_to)),
          supabase
            .from("body_metrics")
            .select("weight_kg")
            .eq("user_id", userId)
            .gte("recorded_at", String(args.period_b_from))
            .lte("recorded_at", String(args.period_b_to)),
        ]);
        const avg = (rows: { weight_kg: number | null }[]) => {
          const valid = rows.filter((r) => r.weight_kg != null);
          return valid.length
            ? Math.round((valid.reduce((s, r) => s + r.weight_kg!, 0) / valid.length) * 10) / 10
            : null;
        };
        return {
          metric,
          period_a: { avg: avg(resA.data ?? []) },
          period_b: { avg: avg(resB.data ?? []) },
        };
      }
      return { error: `Unsupported metric: ${metric}` };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fitness-agent/tools.ts
git commit -m "feat: add fitness agent tool declarations and SQL implementations"
```

---

### Task 9: Simple Path

**Files:**
- Create: `supabase/functions/fitness-agent/simple.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fitness-agent/simple.ts
git commit -m "feat: add simple enriched-call path with keyword gating and history injection"
```

---

### Task 10: Tool-Loop Path

**Files:**
- Create: `supabase/functions/fitness-agent/loop.ts`

- [ ] **Step 1: Create the file**

```typescript
// supabase/functions/fitness-agent/loop.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { type SupabaseClient } from "npm:@supabase/supabase-js";
import { TOOL_DECLARATIONS, executeTool } from "./tools.ts";

const MODEL_NAME = "gemini-2.0-flash";
const MAX_TOOL_ITERATIONS = 2; // classifier + 2 tool rounds + 1 synthesis = 4 max calls

type HistoryItem = { role: "user" | "model"; parts: { text: string }[] };

export async function toolLoopPath(params: {
  genAI: GoogleGenerativeAI;
  supabase: SupabaseClient;
  userId: string;
  question: string;
  windowDays: number;
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

  // Tool-calling loop
  while (iterations < MAX_TOOL_ITERATIONS) {
    const parts = response.response.candidates?.[0]?.content?.parts ?? [];
    const fnCall = parts.find((p: { functionCall?: { name: string; args: Record<string, unknown> } }) => p.functionCall);
    if (!fnCall?.functionCall) break;

    const result = await executeTool(
      fnCall.functionCall.name,
      fnCall.functionCall.args ?? {},
      params.supabase,
      params.userId,
    );
    toolResults.push({ name: fnCall.functionCall.name, result });

    response = await chat.sendMessage([
      {
        functionResponse: {
          name: fnCall.functionCall.name,
          response: { result },
        },
      },
    ]);
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fitness-agent/loop.ts
git commit -m "feat: add tool-loop agent path with max-3-iteration cap and streaming synthesis"
```

---

### Task 11: fitness-agent Entry Point

**Files:**
- Create: `supabase/functions/fitness-agent/index.ts`

- [ ] **Step 1: Create the file**

```typescript
// supabase/functions/fitness-agent/index.ts
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "npm:@supabase/supabase-js";
import { classify } from "./classifier.ts";
import { buildSystemPrompt, type UserTargets } from "./prompts.ts";
import { simplePath } from "./simple.ts";
import { toolLoopPath } from "./loop.ts";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  let body: {
    thread_id?: string;
    message?: string;
    window_days?: number;
    user_targets?: {
      calorieTarget?: number;
      macroTargets?: { protein: number; fat: number; carbs: number };
      fastingTargetHours?: number;
    };
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const threadId = body.thread_id;
  if (!threadId) {
    return new Response(JSON.stringify({ error: "thread_id is required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const windowDays = Math.min(Math.max(1, Math.floor(body.window_days ?? 14)), 90);

  const userTargets: UserTargets = {
    calorieTarget: body.user_targets?.calorieTarget ?? null,
    macroTargets: body.user_targets?.macroTargets ?? null,
    fastingTargetHours: body.user_targets?.fastingTargetHours ?? null,
  };

  // Ensure thread exists in DB (upsert so client-generated UUID is accepted)
  const { data: existingThread } = await supabase
    .from("ai_threads")
    .select("id, title")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingThread) {
    await supabase.from("ai_threads").insert({
      id: threadId,
      user_id: user.id,
      last_active: new Date().toISOString(),
    });
  }

  // Load last 6 messages as history
  const { data: recentMessages } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(6);

  const history = (recentMessages ?? [])
    .reverse()
    .map((m) => ({
      role: m.role === "user" ? "user" : "model" as "user" | "model",
      parts: [{ text: m.content }],
    }));

  const isFirstMessage = !existingThread && (recentMessages ?? []).length === 0;

  // Classify
  const path = await classify(genAI, message);

  // Build system prompt with user targets
  const systemPrompt = buildSystemPrompt(userTargets);

  // Get the appropriate stream
  let contentStream: ReadableStream<Uint8Array>;
  try {
    if (path === "complex") {
      contentStream = await toolLoopPath({
        genAI,
        supabase,
        userId: user.id,
        question: message,
        windowDays,
        history,
        systemPrompt,
      });
    } else {
      contentStream = await simplePath({
        genAI,
        supabase,
        userId: user.id,
        question: message,
        windowDays,
        userTargets,
        history,
        systemPrompt,
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Agent error", detail: String(err) }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Pipe content stream → response, accumulate full text for persistence
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const decoder = new TextDecoder();

  (async () => {
    let fullText = "";
    try {
      const reader = contentStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        await writer.write(value);
      }
      fullText += decoder.decode();

      // Persist user + assistant messages
      await supabase.from("ai_messages").insert([
        { thread_id: threadId, role: "user", content: message },
        { thread_id: threadId, role: "assistant", content: fullText, path },
      ]);

      // Set title on first message (truncate to 60 chars)
      const updates: Record<string, string> = { last_active: new Date().toISOString() };
      if (isFirstMessage) updates.title = message.slice(0, 60);
      await supabase.from("ai_threads").update(updates).eq("id", threadId);

      await writer.close();
    } catch (err) {
      await writer.abort(err);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Path": path,
    },
  });
});
```

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy fitness-agent
```

Expected: Function deployed successfully. URL visible in Supabase dashboard under Edge Functions.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/fitness-agent/
git commit -m "feat: deploy fitness-agent Edge Function with hybrid classifier routing"
```

---

### Task 12: Update lib/gemini.ts

**Files:**
- Modify: `lib/gemini.ts`

- [ ] **Step 1: Add `sendMessage` function**

Add the following after the existing `streamGeminiResponse` function (do not remove `streamGeminiResponse` or `triggerExport`):

```typescript
const FITNESS_AGENT_URL = `${FUNCTIONS_BASE}/fitness-agent`;

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

  const path = (response.headers.get("X-Path") ?? "simple") as "simple" | "complex";

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
```

- [ ] **Step 2: Commit**

```bash
git add lib/gemini.ts
git commit -m "feat: add sendMessage() in lib/gemini targeting fitness-agent Edge Function"
```

---

### Task 13: Redesign InsightsScreen

**Files:**
- Modify: `app/(tabs)/insights.tsx`

- [ ] **Step 1: Replace the file content**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useConversation } from '../../hooks/useConversation';
import type { LocalMessage } from '../../types/conversation';
import { QUICK_PROMPTS, getRotatedPrompts } from '../../constants/prompts';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Chip from '../../components/ui/Chip';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import BottomActionBar from '../../components/ui/BottomActionBar';
import PathBadge from '../../components/PathBadge';
import ThreadSheet from '../../components/ThreadSheet';
import { colors, spacing, typography } from '../../lib/theme';

function StreamingDots() {
  const values = useRef(
    [new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)],
  ).current;

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [values]);

  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingVertical: spacing.xs }}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: colors.text.secondary,
            opacity: value,
          }}
        />
      ))}
    </View>
  );
}

function ChatBubble({ message }: { message: LocalMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={{ marginBottom: spacing.xs }}>
      <View
        style={{
          alignItems: isUser ? 'flex-end' : 'flex-start',
          marginHorizontal: spacing.xl,
        }}
      >
        <View
          style={{
            maxWidth: '84%',
            backgroundColor: isUser ? colors.accent.primaryMuted : colors.bg.surfaceRaised,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: isUser ? colors.accent.primary : colors.border.default,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          {message.role === 'assistant' && message.content === '' ? (
            <StreamingDots />
          ) : isUser ? (
            <Text style={[typography.bodySm, { color: colors.text.primary }]}>
              {message.content}
            </Text>
          ) : (
            <Markdown
              style={{
                body: { ...typography.bodySm, color: colors.text.primary, margin: 0 },
                paragraph: { marginTop: 0, marginBottom: 4 },
                strong: { fontWeight: '700' },
                bullet_list: { marginVertical: 4 },
                ordered_list: { marginVertical: 4 },
              }}
            >
              {message.content}
            </Markdown>
          )}
        </View>
      </View>
      {message.role === 'assistant' && message.path === 'complex' && <PathBadge />}
    </View>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Surface
      style={{
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        borderColor: colors.semantic.danger,
        backgroundColor: 'rgba(240, 106, 106, 0.10)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={[typography.bodySm, { color: colors.semantic.danger, flex: 1 }]}>
          {message}
        </Text>
        <Pressable onPress={onDismiss}>
          <Ionicons name="close" size={18} color={colors.semantic.danger} />
        </Pressable>
      </View>
    </Surface>
  );
}

export default function InsightsScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load insights">
      <InsightsScreenContent />
    </ErrorBoundary>
  );
}

function InsightsScreenContent() {
  const [windowDays, setWindowDays] = useState(14);
  const [inputText, setInputText] = useState('');
  const [showThreadSheet, setShowThreadSheet] = useState(false);
  const [promptDomain, setPromptDomain] = useState<keyof typeof QUICK_PROMPTS>('nutrition');
  const flatListRef = useRef<FlatList<LocalMessage>>(null);

  const {
    messages,
    isStreaming,
    error,
    threadIndex,
    sendMessage,
    createNewThread,
    loadThread,
    deleteThread,
    clearError,
  } = useConversation(windowDays);

  // Rotate prompt domain on each mount
  useEffect(() => {
    const domains = Object.keys(QUICK_PROMPTS) as Array<keyof typeof QUICK_PROMPTS>;
    setPromptDomain(domains[Math.floor(Date.now() / 1000) % domains.length]);
  }, []);

  function handleSend() {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText('');
    void sendMessage(text);
  }

  function handleQuickPrompt(prompt: string) {
    if (isStreaming) return;
    void sendMessage(prompt);
  }

  function handleCopyLast() {
    const last = messages.findLast((m) => m.role === 'assistant');
    if (last) Clipboard.setString(last.content);
  }

  const windowOptions: Array<{ label: string; value: number }> = [
    { label: '7d', value: 7 },
    { label: '14d', value: 14 },
    { label: '30d', value: 30 },
  ];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1 }}>
        <AppHeader
          title="Fitness Assistant"
          trailing={
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="Threads"
                onPress={() => setShowThreadSheet(true)}
                variant="ghost"
                size="md"
              />
              <Button
                label="New"
                onPress={() => { void createNewThread(); }}
                variant="ghost"
                size="md"
              />
            </View>
          }
        />

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
            flexGrow: messages.length === 0 ? 1 : 0,
          }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
              <Surface elevated>
                <Text style={typography.h3}>Ask about your fitness data</Text>
                <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                  Ask about nutrition, training, body composition, or fasting — or across all of them together.
                </Text>
              </Surface>
            </View>
          }
        />

        {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
          }}
        >
          {getRotatedPrompts(promptDomain).map((prompt) => (
            <Chip
              key={prompt}
              label={prompt}
              onPress={() => handleQuickPrompt(prompt)}
            />
          ))}
        </ScrollView>

        <BottomActionBar style={{ paddingTop: spacing.sm }}>
          <Surface overlay elevated style={{ padding: spacing.md }}>
            {/* Window selector */}
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                marginBottom: spacing.sm,
                alignItems: 'center',
              }}
            >
              {windowOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setWindowDays(opt.value)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor:
                      windowDays === opt.value ? colors.accent.primary : colors.border.default,
                    backgroundColor:
                      windowDays === opt.value ? colors.accent.primaryMuted : 'transparent',
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color:
                          windowDays === opt.value ? colors.accent.primary : colors.text.secondary,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              {messages.some((m) => m.role === 'assistant') ? (
                <Pressable onPress={handleCopyLast}>
                  <Ionicons name="copy-outline" size={16} color={colors.text.tertiary} />
                </Pressable>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask anything about your fitness data"
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={1}
                style={[
                  typography.body,
                  {
                    flex: 1,
                    color: colors.text.primary,
                    minHeight: 44,
                    maxHeight: 104,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                  },
                ]}
              />
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() || isStreaming}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !inputText.trim() || isStreaming }}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor:
                    !inputText.trim() || isStreaming
                      ? colors.bg.surfaceRaised
                      : colors.accent.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor:
                    !inputText.trim() || isStreaming
                      ? colors.border.default
                      : colors.accent.primary,
                }}
              >
                {isStreaming ? (
                  <ActivityIndicator size="small" color={colors.text.tertiary} />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={!inputText.trim() ? colors.text.tertiary : colors.bg.canvas}
                  />
                )}
              </Pressable>
            </View>
          </Surface>
        </BottomActionBar>
      </View>

      <ThreadSheet
        visible={showThreadSheet}
        threads={threadIndex}
        onClose={() => setShowThreadSheet(false)}
        onSelectThread={(id) => {
          void loadThread(id);
          setShowThreadSheet(false);
        }}
        onDeleteThread={(id) => { void deleteThread(id); }}
        onNewThread={() => {
          void createNewThread();
          setShowThreadSheet(false);
        }}
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Verify the app builds and navigating to Insights shows the redesigned screen**

```bash
npx expo start
```

Navigate to Insights tab. Confirm: "Fitness Assistant" title, window selector chips, "Threads" and "New" buttons, empty state updated text.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/insights.tsx
git commit -m "feat: redesign InsightsScreen with useConversation, window selector, and markdown"
```

---

## Phase 3 — Proactive Insights

### Task 14: Push Token Registration

**Files:**
- Create: `hooks/usePushToken.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/usePushToken.ts
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export function usePushToken() {
  useEffect(() => {
    void registerToken();
  }, []);
}

async function registerToken() {
  if (Platform.OS === 'web') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  let tokenData: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync();
  } catch {
    return; // Physical device required; silently skip in simulator
  }

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return;

  await supabase.from('user_push_tokens').upsert({
    user_id: session.session.user.id,
    expo_token: tokenData.data,
    updated_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Call the hook from InsightsScreen**

In `app/(tabs)/insights.tsx`, inside `InsightsScreenContent`, add:

```typescript
import { usePushToken } from '../../hooks/usePushToken';

// Inside InsightsScreenContent():
usePushToken();
```

- [ ] **Step 3: Commit**

```bash
git add hooks/usePushToken.ts app/(tabs)/insights.tsx
git commit -m "feat: register Expo push token and upsert to user_push_tokens on Insights load"
```

---

### Task 15: Proactive Edge Function

**Files:**
- Create: `supabase/functions/proactive/index.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy proactive
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/proactive/
git commit -m "feat: add proactive Edge Function for weekly cron insight generation and push"
```

---

### Task 16: pg_cron Schedule

**Files:**
- Supabase dashboard (SQL editor only — no file change)

- [ ] **Step 1: Enable pg_cron extension (if not already enabled)**

In Supabase dashboard → Database → Extensions, enable `pg_cron`.

- [ ] **Step 2: Schedule the cron job**

Run in the Supabase SQL editor:

```sql
SELECT cron.schedule(
  'proactive-fitness-insights',
  '0 8 * * 1,4',  -- Monday and Thursday at 08:00 UTC
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/proactive',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

- [ ] **Step 3: Verify schedule**

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'proactive-fitness-insights';
```

Expected: One row with `active = true` and `schedule = '0 8 * * 1,4'`.

---

### Task 17: ProactiveInsightBanner and useProactiveInsight

**Files:**
- Create: `hooks/useProactiveInsight.ts`
- Create: `components/ProactiveInsightBanner.tsx`
- Modify: `app/(tabs)/insights.tsx`

- [ ] **Step 1: Create `hooks/useProactiveInsight.ts`**

```typescript
// hooks/useProactiveInsight.ts
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { AiProactiveInsightRow } from '../types/database';

export function useProactiveInsight() {
  const [insight, setInsight] = useState<AiProactiveInsightRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      void fetchLatestInsight();
    }, []),
  );

  async function fetchLatestInsight() {
    const { data } = await supabase
      .from('ai_proactive_insights')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setInsight(data ?? null);
  }

  function dismiss() {
    setInsight(null);
  }

  return { insight, dismiss };
}
```

- [ ] **Step 2: Create `components/ProactiveInsightBanner.tsx`**

```typescript
// components/ProactiveInsightBanner.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';
import Surface from './ui/Surface';
import Button from './ui/Button';
import { colors, spacing, typography } from '../lib/theme';
import type { AiProactiveInsightRow } from '../types/database';

type Props = {
  insight: AiProactiveInsightRow;
  onDismiss: () => void;
  onAskAboutThis: (question: string) => void;
};

export default function ProactiveInsightBanner({ insight, onDismiss, onAskAboutThis }: Props) {
  async function handleDismiss() {
    onDismiss();
    await supabase
      .from('ai_proactive_insights')
      .update({ read: true })
      .eq('id', insight.id);
  }

  function handleAsk() {
    onDismiss();
    const preview = insight.content.slice(0, 120);
    onAskAboutThis(`Tell me more about this observation: ${preview}`);
  }

  return (
    <Surface
      style={{
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        borderColor: colors.accent.primary,
        backgroundColor: colors.accent.primaryMuted,
      }}
    >
      <Text
        style={[typography.caption, { color: colors.accent.primary, marginBottom: spacing.xs }]}
      >
        Weekly insight
      </Text>
      <Text
        style={[typography.bodySm, { color: colors.text.primary, marginBottom: spacing.md }]}
        numberOfLines={3}
      >
        {insight.content}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Button
          label="Ask about this"
          onPress={handleAsk}
          variant="secondary"
          size="md"
          style={{ flex: 1 }}
        />
        <Pressable onPress={() => { void handleDismiss(); }} style={{ paddingHorizontal: spacing.sm }}>
          <Text style={[typography.bodySm, { color: colors.text.secondary }]}>Dismiss</Text>
        </Pressable>
      </View>
    </Surface>
  );
}
```

- [ ] **Step 3: Wire banner into InsightsScreen**

In `app/(tabs)/insights.tsx`, add imports:

```typescript
import { useProactiveInsight } from '../../hooks/useProactiveInsight';
import ProactiveInsightBanner from '../../components/ProactiveInsightBanner';
```

Inside `InsightsScreenContent`, add:

```typescript
const { insight, dismiss } = useProactiveInsight();
```

In the JSX, add the banner between `AppHeader` and the `FlatList`:

```typescript
        {insight ? (
          <ProactiveInsightBanner
            insight={insight}
            onDismiss={dismiss}
            onAskAboutThis={(question) => {
              setInputText('');
              void sendMessage(question);
            }}
          />
        ) : null}
```

- [ ] **Step 4: Commit**

```bash
git add hooks/useProactiveInsight.ts components/ProactiveInsightBanner.tsx app/(tabs)/insights.tsx
git commit -m "feat: add proactive insight banner with Ask about this and Dismiss actions"
```

---

## Phase 4 — UI Polish

### Task 18: PathBadge and ThreadSheet Components

**Files:**
- Create: `components/PathBadge.tsx`
- Create: `components/ThreadSheet.tsx`

- [ ] **Step 1: Create `components/PathBadge.tsx`**

```typescript
// components/PathBadge.tsx
import React from 'react';
import { Text } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

export default function PathBadge() {
  return (
    <Text
      style={[
        typography.caption,
        {
          color: colors.text.tertiary,
          marginTop: spacing.xs,
          marginHorizontal: spacing.xl,
          marginBottom: spacing.sm,
        },
      ]}
    >
      · reasoned with tools
    </Text>
  );
}
```

- [ ] **Step 2: Create `components/ThreadSheet.tsx`**

```typescript
// components/ThreadSheet.tsx
import React from 'react';
import { Modal, View, Text, Pressable, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Button from './ui/Button';
import { colors, spacing, typography } from '../lib/theme';
import type { ThreadIndexEntry } from '../types/conversation';

type Props = {
  visible: boolean;
  threads: ThreadIndexEntry[];
  onClose: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onNewThread: () => void;
};

export default function ThreadSheet({
  visible,
  threads,
  onClose,
  onSelectThread,
  onDeleteThread,
  onNewThread,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <Text style={typography.h3}>Conversations</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Button label="New conversation" onPress={onNewThread} />
        </View>

        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelectThread(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={typography.bodySm} numberOfLines={1}>
                  {item.title ?? 'Untitled conversation'}
                </Text>
                <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                  {format(new Date(item.lastActive), 'd MMM yyyy')}
                </Text>
              </View>
              <Pressable
                onPress={() => onDeleteThread(item.id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ marginLeft: spacing.md }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.semantic.danger} />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl }}>
              <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                No past conversations.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/PathBadge.tsx components/ThreadSheet.tsx
git commit -m "feat: add PathBadge and ThreadSheet components"
```

---

### Task 19: Quick Prompts Domain Rotation

**Files:**
- Modify: `constants/prompts.ts`

- [ ] **Step 1: Replace the file content**

```typescript
// constants/prompts.ts

export const QUICK_PROMPTS = {
  nutrition: [
    "Summarise my nutrition for the past 7 days.",
    "On which days did I miss my protein target?",
    "How has my calorie consistency looked this week?",
  ],
  training: [
    "What's my recent training volume trend?",
    "Am I showing progressive overload this month?",
    "Which muscle groups have I trained most this week?",
  ],
  body_comp: [
    "How has my weight trended over the past 30 days?",
    "Is my protein intake supporting my body comp goal?",
    "Correlate my training days with my weight readings.",
  ],
} as const;

export type PromptDomain = keyof typeof QUICK_PROMPTS;

/**
 * Returns the 3 prompts for the given domain.
 * Pass the domain from component state that rotates on screen focus.
 */
export function getRotatedPrompts(domain: PromptDomain): readonly string[] {
  return QUICK_PROMPTS[domain];
}
```

- [ ] **Step 2: Verify no compile errors**

The `InsightsScreen` already imports `QUICK_PROMPTS` and `getRotatedPrompts` as written in Task 13. Confirm TypeScript is happy by running:

```bash
npx tsc --noEmit
```

Expected: No errors related to `constants/prompts.ts`.

- [ ] **Step 3: Commit**

```bash
git add constants/prompts.ts
git commit -m "feat: expand quick prompts to 3 domains with rotation helper"
```

---

### Task 20: Conversation History Compression

**Files:**
- Modify: `supabase/functions/fitness-agent/index.ts`

This task adds thread summary generation when a thread exceeds 10 messages, storing the summary in `ai_threads.summary` and injecting it into the history for subsequent calls.

- [ ] **Step 1: Add `generateThreadSummary` helper to `fitness-agent/index.ts`**

Add before the `Deno.serve(...)` call:

```typescript
async function generateThreadSummary(
  genAI: GoogleGenerativeAI,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
    .join("\n");
  try {
    const result = await model.generateContent(
      `Summarise this fitness assistant conversation in 3-4 sentences, focusing on the key questions asked and insights given. Do not include greetings or sign-offs.\n\n${transcript}`,
    );
    return result.response.text().trim();
  } catch {
    return "";
  }
}
```

- [ ] **Step 2: Update the history-loading block in `Deno.serve` to use the summary**

Replace the existing "Load last 6 messages as history" block with:

```typescript
  // Load recent messages and thread summary
  const { data: allMessages } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const messageCount = allMessages?.length ?? 0;

  // If thread is long, use summary + last 2 messages; otherwise use last 6 messages
  let history: { role: "user" | "model"; parts: { text: string }[] }[] = [];

  if (messageCount > 10) {
    // Check if summary exists; if not, generate and store it
    let summary = existingThread?.summary ?? "";
    if (!summary && allMessages) {
      summary = await generateThreadSummary(genAI, allMessages.slice(0, -2));
      if (summary) {
        await supabase
          .from("ai_threads")
          .update({ summary })
          .eq("id", threadId);
      }
    }
    const last2 = (allMessages ?? []).slice(-2);
    const summaryText = summary
      ? `[Prior conversation summary: ${summary}]\n\n`
      : "";
    // Inject summary as first history item, then last 2 turns
    if (summaryText) {
      history.push({ role: "user", parts: [{ text: summaryText + last2[0]?.content ?? "" }] });
      if (last2[1]) {
        history.push({ role: "model", parts: [{ text: last2[1].content }] });
      }
    } else {
      history = last2.map((m) => ({
        role: m.role === "user" ? "user" : "model" as "user" | "model",
        parts: [{ text: m.content }],
      }));
    }
  } else {
    history = (allMessages ?? []).slice(-6).map((m) => ({
      role: m.role === "user" ? "user" : "model" as "user" | "model",
      parts: [{ text: m.content }],
    }));
  }
```

Also update the `isFirstMessage` check:

```typescript
  const isFirstMessage = messageCount === 0;
```

- [ ] **Step 3: Redeploy the function**

```bash
supabase functions deploy fitness-agent
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/fitness-agent/index.ts
git commit -m "feat: add conversation history compression with thread summary at 10+ messages"
```

---

### Task 21: Final Verification

- [ ] **Step 1: End-to-end smoke test**

1. Open app → Insights tab
2. Send "What did I eat this week?" → confirm simple path responds, `· reasoned with tools` NOT shown
3. Send "Compare my protein on training days vs rest days" → confirm `· reasoned with tools` IS shown
4. Navigate away → return to Insights → confirm conversation history loaded from AsyncStorage (instant, no spinner)
5. Tap "Threads" → confirm ThreadSheet opens with the current conversation listed
6. Tap "New" → confirm a fresh empty conversation starts
7. Change window selector from 14d to 30d → send a question → confirm Edge Function receives `window_days: 30`

- [ ] **Step 2: Verify proactive flow manually**

Invoke the proactive function directly to test it:

```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/proactive \
  -H "Authorization: Bearer <service-role-key>"
```

Expected: `{ "processed": 1 }` (if push token registered). Check `ai_proactive_insights` table has a new row. Reopen the Insights tab — `ProactiveInsightBanner` should appear.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete fitness agent redesign — persistent conversations, hybrid routing, proactive insights"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| DB tables: ai_threads, ai_messages, ai_proactive_insights, user_push_tokens | Task 1 |
| assemble_full_context with workout data + user_targets | Task 1 |
| TypeScript types for new tables | Task 2 |
| LocalThread / LocalMessage types | Task 3 |
| useConversation hook (AsyncStorage + Supabase dual persistence) | Task 4 |
| react-native-markdown-display in ChatBubble | Task 5 |
| Dynamic system prompt builder | Task 6 |
| Classifier with 3s timeout + fallback | Task 7 |
| 5 tools: get_nutrition, get_workouts, get_body_metrics, get_fasting, compute_trends | Task 8 |
| Simple path with keyword gating + history injection | Task 9 |
| Tool-loop path with max 3 iterations + streaming synthesis | Task 10 |
| fitness-agent Edge Function entry point | Task 11 |
| sendMessage() in lib/gemini.ts with X-Path header | Task 12 |
| InsightsScreen redesign (window selector, threads, copy last, prompts) | Task 13 |
| usePushToken hook | Task 14 |
| proactive Edge Function | Task 15 |
| pg_cron Monday+Thursday schedule | Task 16 |
| useProactiveInsight + ProactiveInsightBanner + "Ask about this" | Task 17 |
| PathBadge component | Task 18 |
| ThreadSheet component | Task 18 |
| Quick prompts 9-prompt 3-domain rotation | Task 19 |
| Conversation history compression at 10+ messages | Task 20 |
| Old /gemini function kept deployed | Task 11 (noted — not removed) |

**Placeholder scan:** None found.

**Type consistency:**
- `LocalMessage.path` typed as `'simple' | 'complex' | undefined` ✓ — matches `AiMessageRow.path: string | null` and Edge Function `X-Path` header value ✓
- `sendMessage` in `lib/gemini.ts` `onComplete: (path: 'simple' | 'complex') => void` matches `useConversation` call site ✓
- `useConversation` returns `threadIndex: ThreadIndexEntry[]` — used in `InsightsScreen` `threads={threadIndex}` prop to `ThreadSheet` ✓
- `ThreadSheet` receives `threads: ThreadIndexEntry[]` — defined in `types/conversation.ts` ✓
- `ProactiveInsightBanner` receives `insight: AiProactiveInsightRow` — exported from `types/database.ts` in Task 2 ✓
- `getRotatedPrompts(domain: PromptDomain)` — `PromptDomain = keyof typeof QUICK_PROMPTS` used in `InsightsScreen` `promptDomain` state ✓
