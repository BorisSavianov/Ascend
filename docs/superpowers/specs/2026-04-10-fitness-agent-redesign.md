# Fitness Agent Redesign

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Full redesign of the AI Insights page from a generic nutrition chat into a context-aware, multi-domain fitness assistant agent with persistent conversations, proactive insights, and a hybrid routing architecture.

---

## 1. Current State Analysis

### What exists

| Layer | Current implementation |
|---|---|
| UI | `app/(tabs)/insights.tsx` — chat bubbles, FlatList, TextInput, 5 static quick prompts |
| Hook | `hooks/useGeminiChat.ts` — in-memory message state, streaming via rAF batching |
| Client | `lib/gemini.ts` — POST to `/functions/v1/gemini` with `{ question, window_days: 14 }` |
| Edge Function | `supabase/functions/gemini/index.ts` — auth, context assembly, SHA-256 cache, Gemini streaming |
| Context SQL | `assemble_ai_context(user_id, window_days)` — meals, daily_totals, body_metrics (30d hardcoded), fasting_logs |
| System prompt | Hardcoded string with assumed user profile (16:8, meat-based, Bulgarian dairy) |
| Cache | `ai_insights_cache` table — 1-hour TTL keyed on `(user_id, context_hash, question)` |

### Architectural weaknesses

- **No conversation history.** Each message sent to Gemini is independent. The API is called with the current question only — there is no prior turn context. The chat UI appearance is cosmetic; the model has no memory within or across sessions.
- **Chat state is ephemeral.** Messages live in React component state. Navigating away from the tab destroys the conversation.
- **Workout data entirely absent.** `workout_sessions`, `logged_exercises`, `logged_sets`, `exercises`, `workout_programs`, and `exercise_templates` are all available in the DB and none are included in the AI context.
- **User targets never reach the AI.** `calorieTarget`, `macroTargets`, and `fastingTargetHours` live in Zustand/AsyncStorage and are never sent to the Edge Function. The system prompt hardcodes assumed values.
- **Single-domain, single-turn.** The AI is positioned as a nutrition analyst. Cross-domain reasoning (nutrition + training + body composition) is architecturally impossible with the current context assembly.
- **No proactive layer.** The system is purely reactive. The AI never surfaces an insight unprompted.
- **Static system prompt.** The `SYSTEM_INSTRUCTION` constant never changes regardless of question type or user state.
- **Markdown not rendered.** `ChatBubble` uses a plain `<Text>` component. The model's formatting (bold, bullets, headers) is stripped.
- **`window_days` hardcoded at 14 on the client.** The user has no way to adjust the context window.
- **Body metrics window hardcoded at 30 days** in `assemble_ai_context`, ignoring the `window_days` parameter.

---

## 2. Gap Analysis

### UX gaps
- No persistent conversation history across sessions
- No thread management (start new, switch, delete)
- Markdown not rendered in assistant messages
- Quick prompts are nutrition-only and only visible when chat is empty
- No user control over context window
- No transparency about how the AI reasoned (simple vs tool-augmented)
- No proactive insight surface in the UI
- No way to copy an assistant response

### Data gaps
- Workout sessions, exercises, sets, RPE not in context
- User calorie/macro/fasting targets not sent to AI
- Exercise calorie burns from `exercises` table excluded
- `meal_index` referenced in SQL but `meal_index` column removed in migration 007

### AI capability gaps
- Single-turn only — no multi-turn conversation
- No cross-domain reasoning
- No proactive insight generation
- No anomaly or trend detection
- No tool calling
- No reasoning transparency

### Prompt engineering gaps
- System prompt is static and hardcodes assumed profile values
- Context injected as raw uncompressed JSON
- No context prioritisation or keyword-gated inclusion
- No conversation history injection
- No compression for long threads

### Architectural gaps
- Chat state not persisted to any storage
- No conversation threading model
- Old Edge Function cannot be extended cleanly to support multi-turn, tools, and proactive
- `window_days` not user-controllable
- Cache key does not account for thread context

---

## 3. Proposed System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Native App                      │
│                                                         │
│  InsightsScreen                                         │
│    ├── ProactiveInsightBanner (dismissable card)        │
│    ├── ConversationThread (FlatList, persisted)         │
│    └── ChatInput + QuickPrompts (always visible)        │
│                                                         │
│  useConversation hook                                   │
│    ├── AsyncStorage (local mirror, instant load)        │
│    └── Supabase (source of truth, synced on mount)      │
└──────────────────┬──────────────────────────────────────┘
                   │ POST /functions/v1/fitness-agent
                   │  { thread_id, message, window_days, user_targets }
                   ▼
┌─────────────────────────────────────────────────────────┐
│              fitness-agent Edge Function                │
│                                                         │
│  1. Auth + load thread history from ai_messages         │
│  2. Classify question complexity (3s timeout)           │
│       │                                                 │
│       ├─ SIMPLE → Enriched Single Call                  │
│       │    └── assemble_full_context(sql) → Gemini      │
│       │                                                 │
│       └─ COMPLEX → Tool-Loop Agent (max 3 iterations)   │
│            ├── get_nutrition(days)                      │
│            ├── get_workouts(days)                       │
│            ├── get_body_metrics(days)                   │
│            ├── get_fasting(days)                        │
│            └── compute_trends(metric, period_a, period_b)│
│                                                         │
│  3. Stream response back to client                      │
│  4. Persist message pair to ai_messages                 │
│  5. Update ai_threads.last_active                       │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐   ┌─────────────────────────┐
│  Supabase DB  │   │  proactive Edge Function │
│               │   │  pg_cron: Mon+Thu 08:00  │
│ ai_threads    │   │                          │
│ ai_messages   │   │  1. assemble_full_context│
│ ai_proactive_ │   │  2. single Gemini call   │
│   insights    │   │  3. store insight        │
│ ai_insights_  │   │  4. Expo Push API        │
│   cache       │   └─────────────────────────┘
└───────────────┘
```

### Component responsibilities

| Component | Responsibility |
|---|---|
| `InsightsScreen` | Render thread, banner, input, prompts; own no business logic |
| `useConversation` | Thread lifecycle, AsyncStorage read/write, Supabase sync, send orchestration |
| `fitness-agent` Edge Function | Auth, classify, route, context assembly, stream, persist |
| Classifier | Routing decision only — no data context, 3s timeout, fallback=simple |
| Simple path | `assemble_full_context` SQL + keyword gating + history injection + stream |
| Tool-loop path | Five targeted SQL tools, max 3 iterations, stream synthesis step |
| `proactive` Edge Function | Cron-triggered, weekly summary, single Gemini call, push notification |
| `assemble_full_context` | SQL function returning full cross-domain context JSON |

---

## 4. Database Schema

### New tables

```sql
-- Conversation threads
CREATE TABLE ai_threads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title        TEXT,
  summary      TEXT,              -- compressed history summary, updated at 10+ messages
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_active  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ai_threads_user_active ON ai_threads (user_id, last_active DESC);

ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_threads_owner ON ai_threads
  USING (user_id = auth.uid());

-- Messages within threads
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
  USING (EXISTS (
    SELECT 1 FROM ai_threads t
    WHERE t.id = thread_id AND t.user_id = auth.uid()
  ));

-- Proactive insights from cron
CREATE TABLE ai_proactive_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content      TEXT NOT NULL,
  category     TEXT CHECK (category IN ('nutrition', 'training', 'body_comp', 'fasting')),
  read         BOOLEAN DEFAULT false,
  notified     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_proactive_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_proactive_owner ON ai_proactive_insights
  USING (user_id = auth.uid());

-- Push notification tokens
CREATE TABLE user_push_tokens (
  user_id     UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  expo_token  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_token_owner ON user_push_tokens
  USING (user_id = auth.uid());
```

### Updated SQL function

```sql
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
    'generated_at',   now(),
    'window_days',    p_window_days,

    'user_targets', json_build_object(
      'calorie_target',  p_calorie_target,
      'macro_targets',   p_macro_targets,
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
          'meal_calories', (SELECT ROUND(SUM(calories)::NUMERIC,1) FROM meal_items WHERE meal_id = m.id),
          'meal_protein',  (SELECT ROUND(SUM(protein_g)::NUMERIC,1) FROM meal_items WHERE meal_id = m.id),
          'items',         (
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
            'name',        et.name,
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
        AND ws.date::DATE >= now()::DATE - (p_window_days || ' days')::INTERVAL
    ),

    'body_metrics', (
      SELECT json_agg(json_build_object(
        'date',         DATE(recorded_at),
        'weight_kg',    weight_kg,
        'body_fat_pct', body_fat_pct,
        'notes',        notes
      ) ORDER BY recorded_at DESC)
      FROM body_metrics
      WHERE user_id = p_user_id
        AND recorded_at >= now() - '30 days'::INTERVAL
      LIMIT 10
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

### AsyncStorage schema (local thread mirror)

```ts
// Key: `@ai_thread_<thread_id>`
type LocalThread = {
  id: string;
  title: string | null;
  lastActive: string;            // ISO string
  messages: LocalMessage[];      // last 30 messages cached
};

type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  path?: 'simple' | 'complex';
  createdAt: string;
};

// Active thread pointer
// Key: `@ai_active_thread` → thread_id string

// Thread index (for bottom sheet list)
// Key: `@ai_thread_index` → LocalThread[] (id, title, lastActive only)
```

Max 10 threads stored locally. Older threads are evicted from AsyncStorage on creation of the 11th but remain in Supabase.

---

## 5. Agent Design

### Classifier

A minimal pre-call to Gemini Flash. No data context. Costs ~50 tokens.

**System prompt:**
```
You are a question router. Classify the user's fitness question.
Reply with ONLY one word:
- "simple"  — single domain, one time period, no cross-referencing needed
- "complex" — crosses domains (nutrition + training), requires temporal
              comparison, trend correlation, or anomaly detection
```

**Rules:**
- Timeout: **3 seconds**. On timeout or unexpected response: fallback = `simple`
- Uses `generateContent` (not streaming)
- Called before any data is fetched

**Routing examples:**

| Question | Route |
|---|---|
| "What did I eat yesterday?" | simple |
| "How long was my last fast?" | simple |
| "Summarise my week" | simple |
| "Is my protein high enough on training days?" | complex |
| "Correlate my weight with workout volume" | complex |
| "Compare this week vs last week across everything" | complex |

---

### Simple Path

```
assemble_full_context(sql, user_targets)
  → keyword-gate: include detailed meals? include fasting?
  → inject last 6 messages of conversation history
  → build dynamic system prompt
  → Gemini Flash (streaming)
  → stream to client
  → persist message pair to ai_messages
```

**Keyword gating (zero-cost, runs before SQL call):**
```ts
const includeDetailedMeals = /food|ate|eat|meal|item|ingredient/i.test(question);
const includeFasting = /fast|window|break|16:8/i.test(question);
```

When `includeDetailedMeals` is false, the `meals` array is omitted from the assembled context — only `daily_totals` is included. This reduces context size by 20–40% for most workout and body composition questions.

---

### Complex Path (Tool-Loop Agent)

Max **3 iterations** (up to 2 tool-call rounds + 1 synthesis). Final synthesis step streams.

**Available tools:**

```ts
get_nutrition(days: number): DailyTotals[]
// → daily_totals from daily_summaries view for last N days

get_workouts(days: number): WorkoutSession[]
// → workout_sessions with exercises and sets for last N days

get_body_metrics(days: number): BodyMetric[]
// → body_metrics readings for last N days

get_fasting(days: number): FastingLog[]
// → fasting_logs for last N days

compute_trends(
  metric: 'calories' | 'protein' | 'weight' | 'volume',
  period_a: { from: string; to: string },
  period_b: { from: string; to: string }
): TrendComparison
// → SQL aggregate comparison between two date ranges
// → no additional Gemini call
```

Each tool maps to a targeted SQL query. No tool calls `assemble_full_context`.

**Worst-case token cost per complex question:** ~4 Gemini calls (classifier + 2 tool rounds + synthesis). Given twice-weekly proactive runs and typical usage, this stays within free tier limits.

---

### Proactive Insights Function (`/proactive`)

**Trigger:** `pg_cron` schedule `0 8 * * 1,4` (Monday + Thursday, 08:00 UTC)

**Flow:**
1. Fetch all users with push tokens from `user_push_tokens`
2. Skip users with no data in the past 7 days (avoid wasted calls)
3. Call `assemble_full_context(user_id, 7)` — 7-day window only
4. Single Gemini call with proactive system prompt (non-streaming)
5. Store result in `ai_proactive_insights` with `notified = false`
6. POST to Expo Push API
7. Mark `notified = true`

**Token cost per run:** ~800–1200 tokens. At twice/week: ~2400 tokens/week.

---

## 6. Prompt Engineering Strategy

### Dynamic System Prompt Structure

Three blocks assembled at request time:

```
[IDENTITY BLOCK — static]
You are a personal fitness assistant for a single user.
Your domain covers nutrition, resistance training, body composition,
and intermittent fasting. You reason across all domains together.

[PROFILE BLOCK — injected from user_targets]
User targets: {calorieTarget} kcal/day
Macros: {protein}g protein / {fat}g fat / {carbs}g carbs
Fasting protocol: {fastingTargetHours}h target window
Diet style: primarily meat-based, Bulgarian dairy
Logging precision: portion estimates (±15%) — treat gram weights as approximations
Language: respond in the same language the user writes in

[BEHAVIOUR BLOCK — static]
- Be analytically direct. No moralising, no hedging.
- Reference specific dates when making trend claims.
- When data is missing, state exactly what is missing.
- Do not repeat raw numbers back — interpret and summarise.
- For training data: comment on progressive overload and recovery signals.
- Cross-domain observations are high value — prioritise them.
```

### Context Injection Order (Simple Path)

Priority order, highest signal first:

1. System prompt (above)
2. Conversation history — last 6 messages (or compressed summary if thread > 10 messages)
3. Current week `daily_totals`
4. `workout_sessions` (last `window_days`, sets collapsed to: max weight, total volume, avg RPE)
5. `body_metrics` (last 10 readings)
6. `fasting_logs` (last `window_days`) — only if `includeFasting` gate is true
7. Detailed `meals` with items — only if `includeDetailedMeals` gate is true

### Conversation History Compression

When a thread exceeds 10 messages, prior turns are summarised:

```
[Prior context summary:]
User asked about protein consistency. Assistant noted protein averaged 142g,
below the 160g target on 3 of 7 days — all rest days.

[Recent messages:]
User: {second-to-last user message}
Assistant: {second-to-last assistant message}
User: {last user message}
```

The summary is generated once via a non-streaming Gemini call and stored in `ai_threads.summary`. It is regenerated whenever a thread exceeds a further 10 messages.

### Proactive System Prompt

```
You are a fitness analyst reviewing one week of data for a single user.
Identify the single most actionable observation — something specific,
data-backed, and non-obvious. It must be something the user can act on
this week. One paragraph, no greeting, no sign-off.
Categories to consider: nutrition adherence, training progression,
body composition trend, fasting consistency, cross-domain pattern.
```

---

## 7. UI/UX Redesign

### Screen Layout

```
┌────────────────────────────────────────┐
│  AppHeader: "Fitness Assistant"        │
│  subtitle: last active thread date     │
│  trailing: [Threads] [Clear]           │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ProactiveInsightBanner           │  │
│  │ "This week: protein dropped..."  │  │
│  │ [Ask about this]     [Dismiss]   │  │
│  └──────────────────────────────────┘  │
│  (only when unread insight exists)     │
│                                        │
│  ConversationThread (FlatList)         │
│  ├── ChatBubble (user)                 │
│  ├── ChatBubble (assistant)            │
│  │     └── MarkdownText renderer       │
│  ├── PathBadge: "· reasoned with tools"│
│  │   (complex-path messages only)     │
│  └── StreamingDots (existing)         │
│                                        │
│  QuickPrompts (horizontal chips)       │
│  — always visible                      │
│  — 3 prompts shown, domain rotates    │
│    on each screen focus               │
├────────────────────────────────────────┤
│  BottomActionBar                       │
│  ┌─── TextInput ──────────┐  [Send]   │
│  └────────────────────────┘           │
│  [Threads]  [14d ▾]  [copy last]      │
└────────────────────────────────────────┘
```

### Component changes

| Component | Change |
|---|---|
| `AppHeader` | Title → "Fitness Assistant"; subtitle → last active date |
| `ChatBubble` | Replace `<Text>` with `react-native-markdown-display` |
| `ProactiveInsightBanner` | New component; queries `ai_proactive_insights` on screen focus |
| `PathBadge` | New component; renders `· reasoned with tools` under complex-path messages |
| Quick prompts | Expand to 9 prompts across 3 domains; show 3 at a time; rotate on focus |
| Window selector `[14d ▾]` | New bottom sheet or dropdown; options: 7d / 14d / 30d; session-persisted |
| Thread sheet | New bottom sheet; list threads by title + date; new/delete thread |

### Quick prompts

```ts
const QUICK_PROMPTS = {
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
};
```

Domain rotates on each `useEffect` screen focus: `nutrition → training → body_comp → nutrition...`

### ProactiveInsightBanner interaction

- Shown when `ai_proactive_insights` has an unread record for the user
- `[Dismiss]` → marks `read = true` in Supabase, hides banner
- `[Ask about this]` → pre-fills TextInput with a question derived from the insight content, auto-sends it, attaches proactive insight ID to the new thread

### PathBadge

Renders below the assistant bubble text only when `path = 'complex'`. Subtle caption style: `· reasoned with tools`. Not shown for simple-path messages. Provides reasoning transparency without UI clutter.

---

## 8. Implementation Roadmap

### Phase 1 — Foundation

1. DB migration: `ai_threads`, `ai_messages`, `ai_proactive_insights`, `user_push_tokens`, RLS policies
2. DB migration: `assemble_full_context` SQL function (replaces `assemble_ai_context`)
3. `useConversation` hook — AsyncStorage read on mount, Supabase sync in background, write-local-first on send
4. Thread persistence — save/load thread from Supabase, local eviction at 10 threads
5. Install `react-native-markdown-display` — swap `<Text>` in `ChatBubble`

_Phase 2 depends on: `useConversation` hook and DB migrations complete._

### Phase 2 — Agent Core

6. `fitness-agent` Edge Function — auth → load thread history → classifier (3s timeout, fallback=simple) → route → stream → persist
7. Classifier implementation — fast `generateContent` call, 3-second timeout, fallback to simple
8. Simple path — `assemble_full_context` with keyword gating, history injection, dynamic system prompt, user_targets from request body
9. Tool-loop path — five tools as Deno functions, max 3 iterations, streaming synthesis
10. Update `lib/gemini.ts` — new `sendMessage(threadId, message, userTargets, windowDays)` function pointing at `/fitness-agent`
11. Deprecate `/gemini` Edge Function — keep deployed, stop calling from client

### Phase 3 — Proactive Insights

12. Push token registration — register Expo push token on app launch, upsert to `user_push_tokens`
13. `proactive` Edge Function — 7-day summary, single Gemini call, store insight, Expo Push API call
14. `pg_cron` schedule — `0 8 * * 1,4`
15. `ProactiveInsightBanner` component — query on screen focus, `[Ask about this]`, `[Dismiss]`

### Phase 4 — UI Polish

16. Thread management bottom sheet — list, new, delete
17. Quick prompts domain rotation — 3-domain sets, rotate on screen focus
18. `PathBadge` component — `· reasoned with tools` on complex-path messages
19. Window selector `[14d ▾]` — 7d/14d/30d, wired to request body
20. Conversation history compression — generate summary at 10 messages, store on `ai_threads.summary`
21. `[copy last]` button — copy last assistant message to clipboard
22. Update `AppHeader` title and subtitle

---

## 9. Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| Classifier adds latency | 3-second timeout with instant fallback to simple path |
| Tool loop could hit free tier on heavy use | Hard cap at 3 iterations; complex path only for genuinely cross-domain questions |
| AsyncStorage/Supabase sync conflicts | AsyncStorage written first; Supabase is source of truth on conflict — local is overwritten on reconcile |
| Proactive Gemini call twice/week | ~2400 tokens/week — negligible; cron skips users with no data in past 7 days |
| `react-native-markdown-display` bundle size | ~30kb gzipped — acceptable |
| Thread summary generation cost | Single call per 10 messages — infrequent; skipped if thread is short |
| Old `/gemini` function in-flight during transition | Keep deployed; deprecate only after `/fitness-agent` is confirmed stable |
