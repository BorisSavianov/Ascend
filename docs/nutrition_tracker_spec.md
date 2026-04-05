# Personal Nutrition Tracker — Implementation Specification
**Version:** 2.0 (Gemini AI Studio edition)
**Target:** Single-user, mobile-first, AI-integrated calorie and body metrics tracker  
**Stack:** React Native (Expo) · Supabase · Google Gemini API (AI Studio — free tier)  
**Prepared for:** Claude Code implementation

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Data Model](#3-data-model)
4. [Gemini Integration Design](#4-gemini-integration-design)
5. [API Specification](#5-api-specification)
6. [UI/UX Specification](#6-uiux-specification)
7. [Performance Optimization](#7-performance-optimization)
8. [Development Plan](#8-development-plan)
9. [Extensibility Strategy](#9-extensibility-strategy)

---

## 1. System Architecture

### 1.1 Overview

The system is a three-layer personal productivity application:

```
┌────────────────────────────────────────────────────────┐
│              MOBILE CLIENT (Expo / RN)                 │
│                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Quick Log│ │  Daily   │ │  Gemini  │ │ Metrics  │  │
│  │ Screen   │ │ Summary  │ │   Chat   │ │ Tracker  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └────────────┴────────────┴─────────────┘        │
│                    supabase-js SDK                     │
└──────────────────────┬─────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼─────────────────────────────────┐
│                    SUPABASE                            │
│                                                        │
│  ┌─────────────────────┐   ┌────────────────────────┐  │
│  │   PostgreSQL DB      │   │    Edge Functions      │  │
│  │                      │   │    (Deno runtime)      │  │
│  │  foods               │   │                        │  │
│  │  meals               │   │  POST /gemini          │  │
│  │  meal_items          │   │  POST /export/markdown │  │
│  │  body_metrics        │   │  POST /export/csv      │  │
│  │  fasting_logs        │   │                        │  │
│  │  exercises           │   └──────────┬─────────────┘  │
│  │  ai_insights_cache   │              │                │
│  └──────────────────────┘              │                │
│                                        │                │
│  ┌─────────────────────┐              │                │
│  │   Row Level Security│              │                │
│  └─────────────────────┘              │                │
└───────────────────────────────────────┼────────────────┘
                                        │ HTTPS
                             ┌──────────▼───────────┐
                             │  Google AI Studio     │
                             │  gemini-2.0-flash     │
                             │  Free: 1,500 req/day  │
                             │  On-demand only       │
                             └──────────────────────┘
```

### 1.2 Component Rationale

**Mobile Client (Expo React Native)**
All data entry occurs on mobile (Samsung S25). Expo provides first-party support for
notifications, camera (future photo logging), and device APIs without ejecting. The new
architecture (Fabric/JSI) is enabled by default in Expo SDK 52+, providing near-native UI
performance. `supabase-js` communicates directly with Supabase, eliminating a custom API
gateway for standard CRUD.

**Supabase (PostgreSQL + Edge Functions)**
Chosen over Firebase because:
- The data model is inherently relational (meals → meal_items → foods). NoSQL would require
  denormalisation and client-side joins, degrading both query simplicity and AI context quality.
- Native SQL aggregation produces clean, LLM-consumable JSON in a single query.
- Edge Functions (Deno) replace a custom backend for the two operations requiring server-side
  secrets: the Gemini API proxy and export generation.
- Free tier is permanent and sufficient for personal use (~500MB DB).

**Google Gemini API via AI Studio (gemini-2.0-flash)**
Chosen as the AI layer because:
- AI Studio API key is permanently free at 1,500 requests/day — orders of magnitude above
  any realistic personal daily usage (expected: 5–20 queries/day).
- No credit card required. No billing account required.
- `gemini-2.0-flash` is highly capable for structured data analysis and trend identification.
- 1M token context window — the entire nutrition log history could fit in one request.
- Google Generative AI SDK (npm) works natively in Deno (Supabase Edge Functions).
- API key is stored server-side in the Edge Function only — never on the mobile device.

**AI Studio vs Vertex AI (Google Cloud)**
AI Studio is the correct choice here. Vertex AI requires a billing account and GCP project.
AI Studio provides the same `gemini-2.0-flash` model with a permanent free quota via a
simple API key, with no infrastructure overhead.

**Rejected alternatives:**
- *Anthropic Claude API*: Paid; no permanent free tier sufficient for ongoing use.
- *OpenAI API*: Paid; no permanent free tier.
- *Ollama (local)*: Requires local server always running and accessible from mobile; adds
  operational complexity. Viable as fallback but not primary.
- *Firebase*: NoSQL model forces denormalisation; no native SQL aggregation.

### 1.3 Data Flow

**Logging flow:**
```
User taps food → selects from personal library → enters portion
→ supabase-js inserts meal + meal_items → UI updates via TanStack Query invalidation
```

**AI insight flow:**
```
User types question → app calls POST /gemini (Edge Function)
→ Edge Function runs SQL to assemble context
→ Serialises to JSON → prepends system instruction
→ Calls Gemini API (streaming) → streams response back to app
```

**Notification flow:**
```
Expo Notifications scheduler → local triggers (no server required)
→ configurable reminder times stored in AsyncStorage
```

---

## 2. Technology Stack

### 2.1 Explicit Stack Decisions

| Layer | Choice | Version | Justification |
|---|---|---|---|
| Mobile framework | Expo (React Native) | SDK 52+ | New arch enabled; mature ecosystem; S25 compatible |
| Language | TypeScript | 5.x strict mode | End-to-end type safety; Supabase generates types from schema |
| Navigation | Expo Router | v4 | File-system routing; tab + stack navigation without config overhead |
| State management | Zustand | 4.x | Minimal boilerplate; sufficient for single-user local UI state |
| Server state / cache | TanStack Query | v5 | Query caching, background refetch, optimistic updates |
| Supabase client | supabase-js | v2 | Official SDK; realtime subscriptions; auth handling |
| Backend runtime | Supabase Edge Functions (Deno) | Latest | Zero-maintenance serverless; secret management built in |
| DB | Supabase Postgres | 15 | Relational; JSON aggregation; native RLS |
| Schema migrations | Supabase CLI migrations | — | Version-controlled SQL migrations |
| Validation | Zod | 3.x | Schema validation shared between client and Edge Functions |
| Charts | Victory Native | 41.x | React Native-native SVG rendering; no WebView dependency |
| Notifications | Expo Notifications | — | First-party; background scheduling; S25 compatible |
| Icons | Expo Vector Icons (Phosphor) | — | Consistent icon set; tree-shakeable |
| Styling | NativeWind | v4 | Tailwind classes on React Native |
| AI model | gemini-2.0-flash (AI Studio) | Latest | Free, permanent, 1M context window, strong analytical capability |
| AI SDK | @google/generative-ai | Latest | Official Google SDK; Deno-compatible |

### 2.2 AI Studio Free Tier Limits

| Limit | Value | Personal usage estimate |
|---|---|---|
| Requests per day | 1,500 | 5–20 expected |
| Requests per minute | 15 | Never exceeded (on-demand only) |
| Input tokens per minute | 1,000,000 | Never exceeded |
| Context window | 1,000,000 tokens | ~6,000 tokens per query |
| Cost | $0.00 | Permanent |

At the expected query rate, the free tier provides roughly **75–300× headroom** over actual usage.

### 2.3 Serialisation

All data exchanged between client and Supabase uses JSON (default for `supabase-js`).
AI context payloads are serialised as compact JSON (no pretty-printing) to keep input token
count minimal, though the 1M context window makes this a courtesy rather than a hard
requirement. Dates are always ISO 8601 strings with timezone (`TIMESTAMPTZ`).

---

## 3. Data Model

### 3.1 Schema Design Principles

- Fields are named for human readability because they appear verbatim in the AI context JSON.
  `protein_g` is unambiguous to a language model; `p` is not.
- Nutritional values are denormalised into `meal_items` (copied from `foods` at log time).
  This ensures historical accuracy if food entries are later corrected.
- All tables include `created_at` and `updated_at` for temporal queries.
- UUIDs as primary keys. Supabase convention; avoids sequential ID information leakage.
- `user_id` is present on all tables for RLS, even though only one user exists.
  This future-proofs the schema at zero cost.

### 3.2 Complete SQL Schema

```sql
-- ============================================================
-- EXTENSION
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- FOODS — personal food library
-- Pre-seeded with user's regular foods
-- ============================================================
CREATE TABLE foods (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL DEFAULT auth.uid(),

  -- Identity
  name                TEXT NOT NULL,          -- English name, used in AI context
  name_local          TEXT,                   -- Bulgarian name (kashkaval, kiselo mlyako)
  brand               TEXT,                   -- null for home-cooked items
  barcode             TEXT,                   -- null until barcode scanning added

  -- Nutritional values per 100g (source of truth)
  calories_per_100g   NUMERIC(7,2) NOT NULL,
  protein_per_100g    NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_per_100g        NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_per_100g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  fiber_per_100g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  sugar_per_100g      NUMERIC(6,2),
  sodium_per_100g     NUMERIC(7,2),           -- mg per 100g

  -- Metadata
  is_custom           BOOLEAN NOT NULL DEFAULT TRUE,
  use_count           INTEGER NOT NULL DEFAULT 0,  -- for sorting "frequent" list
  notes               TEXT,                   -- e.g. "homemade, slightly sweet"
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_foods_user_id ON foods(user_id);
CREATE INDEX idx_foods_use_count ON foods(use_count DESC);
CREATE INDEX idx_foods_name ON foods USING gin(to_tsvector('simple', name));

-- ============================================================
-- MEALS — a single eating event
-- ============================================================
CREATE TABLE meals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL DEFAULT auth.uid(),

  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  meal_index  SMALLINT NOT NULL DEFAULT 1,         -- 1 = first meal, 2 = second meal
  meal_label  TEXT,                                -- optional free text
  notes       TEXT,                                -- context for AI: "felt full early"

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meals_user_logged ON meals(user_id, logged_at DESC);
CREATE INDEX idx_meals_date ON meals(user_id, DATE(logged_at));

-- ============================================================
-- MEAL_ITEMS — individual food entries within a meal
-- Nutritional values DENORMALISED from foods at log time
-- ============================================================
CREATE TABLE meal_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id         UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id         UUID REFERENCES foods(id) ON DELETE SET NULL,

  -- Denormalised identity (persists even if food is deleted)
  food_name       TEXT NOT NULL,
  food_name_local TEXT,

  -- Quantity
  amount_g        NUMERIC(7,1),
  portion_desc    TEXT,           -- "1 large piece", "2 eggs", "handful"
  -- Constraint: at least one of amount_g or portion_desc must be non-null

  -- Denormalised nutrition (calculated at log time from amount_g)
  calories        NUMERIC(7,2) NOT NULL,
  protein_g       NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_g           NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_g         NUMERIC(6,2) NOT NULL DEFAULT 0,
  fiber_g         NUMERIC(6,2) NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_items_meal_id ON meal_items(meal_id);
CREATE INDEX idx_meal_items_food_id ON meal_items(food_id);

ALTER TABLE meal_items
  ADD CONSTRAINT chk_quantity CHECK (amount_g IS NOT NULL OR portion_desc IS NOT NULL);

-- ============================================================
-- BODY_METRICS
-- ============================================================
CREATE TABLE body_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),

  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg       NUMERIC(5,2),
  body_fat_pct    NUMERIC(5,2),
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_body_metrics_user_date ON body_metrics(user_id, recorded_at DESC);

-- ============================================================
-- FASTING_LOGS
-- ============================================================
CREATE TABLE fasting_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),

  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  target_hours    SMALLINT NOT NULL DEFAULT 16,
  actual_hours    NUMERIC(4,1)
    GENERATED ALWAYS AS (
      CASE WHEN ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600
        ELSE NULL
      END
    ) STORED,
  completed       BOOLEAN
    GENERATED ALWAYS AS (
      CASE WHEN ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600 >= target_hours
        ELSE NULL
      END
    ) STORED,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fasting_user_date ON fasting_logs(user_id, started_at DESC);

-- ============================================================
-- EXERCISES
-- ============================================================
CREATE TABLE exercises (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),

  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  name            TEXT NOT NULL,
  category        TEXT,                        -- "strength", "cardio"
  duration_min    SMALLINT,
  calories_burned NUMERIC(6,1),
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_user_date ON exercises(user_id, logged_at DESC);

-- ============================================================
-- AI_INSIGHTS_CACHE
-- Caches Gemini responses to avoid duplicate API calls
-- within the same data window
-- ============================================================
CREATE TABLE ai_insights_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),

  context_hash    TEXT NOT NULL,    -- SHA-256 of context JSON + question
  question        TEXT NOT NULL,
  response        TEXT NOT NULL,
  model           TEXT NOT NULL,    -- e.g. "gemini-2.0-flash"
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, context_hash)
);

CREATE INDEX idx_cache_hash ON ai_insights_cache(user_id, context_hash);

-- ============================================================
-- DAILY SUMMARY VIEW
-- ============================================================
CREATE VIEW daily_summaries AS
SELECT
  m.user_id,
  DATE(m.logged_at)                             AS log_date,
  COUNT(DISTINCT m.id)                          AS meal_count,
  ROUND(SUM(mi.calories)::NUMERIC, 1)           AS total_calories,
  ROUND(SUM(mi.protein_g)::NUMERIC, 1)          AS total_protein_g,
  ROUND(SUM(mi.fat_g)::NUMERIC, 1)              AS total_fat_g,
  ROUND(SUM(mi.carbs_g)::NUMERIC, 1)            AS total_carbs_g,
  ROUND(SUM(mi.fiber_g)::NUMERIC, 1)            AS total_fiber_g,
  ROUND(SUM(mi.calories) / NULLIF(
    SUM(mi.protein_g + mi.fat_g + mi.carbs_g), 0
  )::NUMERIC, 2)                                AS calorie_density,
  MIN(m.logged_at)                              AS first_meal_at,
  MAX(m.logged_at)                              AS last_meal_at
FROM meals m
JOIN meal_items mi ON mi.meal_id = m.id
GROUP BY m.user_id, DATE(m.logged_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE foods              ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_metrics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fasting_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights_cache  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns_row" ON foods             FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON meals             FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_meal_items" ON meal_items
  FOR ALL USING (meal_id IN (SELECT id FROM meals WHERE user_id = auth.uid()));
CREATE POLICY "user_owns_row" ON body_metrics      FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON fasting_logs      FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON exercises         FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON ai_insights_cache FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- SEED: Personal food library
-- Run after auth user is created
-- ============================================================
INSERT INTO foods (
  name, name_local,
  calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g,
  notes
) VALUES
  ('Kashkaval',        'Кашкавал',      370, 26.0, 29.0,  1.5,  0,    'Bulgarian yellow cheese'),
  ('Kiselo mlyako',    'Кисело мляко',   63,  3.5,  3.5,  4.7,  0,    '3.6% fat standard'),
  ('Oats',             'Овесени ядки',  389, 17.0,  7.0, 66.0, 10.6,  'dry weight'),
  ('Homemade honey',   'Домашен мед',   304,  0.3,  0.0, 82.4,  0.2,  'local, unprocessed'),
  ('Chicken breast',   'Пилешки гърди', 165, 31.0,  3.6,  0.0,  0,    'raw weight'),
  ('Beef mince 80/20', 'Телешка кайма', 254, 17.0, 20.0,  0.0,  0,    'raw weight'),
  ('Pork neck',        'Свинска плешка',230, 16.0, 18.0,  0.0,  0,    'raw weight'),
  ('Eggs',             'Яйца',          143, 13.0, 10.0,  0.7,  0,    'large, ~60g each'),
  ('Olive oil',        'Зехтин',        884,  0.0,100.0,  0.0,  0,    NULL),
  ('Butter',           'Масло',         717,  0.9, 81.0,  0.1,  0,    NULL);
```

### 3.3 Schema Design Decisions for AI Quality

**Why denormalise nutrition into `meal_items`?**
The AI receives a snapshot of what was eaten, not a pointer to another table. Joining at
query time for AI context adds latency and complexity. Denormalisation means the context
query is a single scan of `meal_items` with no joins on the hot path.

**Why `food_name` and `food_name_local` both in `meal_items`?**
The AI receives `food_name` (English) for nutritional reasoning and `food_name_local` for
pattern recognition. Both fields carry distinct analytical value.

**Why `portion_desc` alongside `amount_g`?**
Rough estimates are the stated precision level. "1 large piece of kashkaval" is legitimate
data. The model can reason about approximate gram equivalents better than receiving a null
value with no context.

**Why the `daily_summaries` view?**
The dashboard query that runs on every app open hits the view rather than re-aggregating
raw rows each time. A regular view with proper indexes is sufficient at this data volume.

---

## 4. Gemini Integration Design

### 4.1 Why gemini-2.0-flash

| Model | Free tier | Context window | Quality | Streaming |
|---|---|---|---|---|
| gemini-2.0-flash | 1,500 req/day | 1,000,000 tokens | ★★★★ | ✅ |
| gemini-1.5-flash | 1,500 req/day | 1,000,000 tokens | ★★★ | ✅ |
| gemini-1.5-pro | 50 req/day | 2,000,000 tokens | ★★★★★ | ✅ |

`gemini-2.0-flash` is the correct default: it is Google's latest efficient model, the free
quota is 30× the expected daily usage, and streaming is natively supported. `gemini-1.5-pro`
is available as a fallback for complex analytical sessions where reasoning depth matters more
than throughput.

### 4.2 Architecture: Edge Function Proxy

The AI API key is stored exclusively in the Supabase Edge Function environment — never in
the mobile client. The Edge Function:

1. Authenticates the request via Supabase JWT
2. Assembles the context JSON from Postgres (single SQL call)
3. Checks the `ai_insights_cache` for a matching hash
4. If cache miss: calls Gemini API with streaming enabled
5. Streams the response back to the mobile client
6. Stores the response in `ai_insights_cache` on completion

### 4.3 Context Assembly SQL Function

Stored as a Postgres function for reuse and testability:

```sql
CREATE OR REPLACE FUNCTION assemble_ai_context(
  p_user_id    UUID,
  p_window_days INTEGER DEFAULT 14
)
RETURNS JSON
LANGUAGE SQL
STABLE
AS $$
  SELECT json_build_object(
    'generated_at',  now(),
    'window_days',   p_window_days,

    'meals', (
      SELECT json_agg(meal_obj ORDER BY (meal_obj->>'logged_at') DESC)
      FROM (
        SELECT json_build_object(
          'date',          DATE(m.logged_at),
          'time',          TO_CHAR(m.logged_at, 'HH24:MI'),
          'meal_index',    m.meal_index,
          'label',         m.meal_label,
          'notes',         m.notes,
          'meal_calories', (SELECT ROUND(SUM(calories)::NUMERIC, 1) FROM meal_items WHERE meal_id = m.id),
          'meal_protein',  (SELECT ROUND(SUM(protein_g)::NUMERIC, 1) FROM meal_items WHERE meal_id = m.id),
          'items', (
            SELECT json_agg(json_build_object(
              'food',       mi.food_name,
              'food_bg',    mi.food_name_local,
              'amount_g',   mi.amount_g,
              'portion',    mi.portion_desc,
              'calories',   mi.calories,
              'protein_g',  mi.protein_g,
              'fat_g',      mi.fat_g,
              'carbs_g',    mi.carbs_g,
              'fiber_g',    mi.fiber_g
            ))
            FROM meal_items mi
            WHERE mi.meal_id = m.id
          )
        ) AS meal_obj
        FROM meals m
        WHERE m.user_id = p_user_id
          AND m.logged_at >= now() - (p_window_days || ' days')::INTERVAL
      ) sub
    ),

    'daily_totals', (
      SELECT json_agg(json_build_object(
        'date',       log_date,
        'calories',   total_calories,
        'protein_g',  total_protein_g,
        'fat_g',      total_fat_g,
        'carbs_g',    total_carbs_g,
        'fiber_g',    total_fiber_g,
        'meals',      meal_count
      ) ORDER BY log_date DESC)
      FROM daily_summaries
      WHERE user_id = p_user_id
        AND log_date >= now() - (p_window_days || ' days')::INTERVAL
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
    ),

    'fasting_logs', (
      SELECT json_agg(json_build_object(
        'started',       started_at,
        'ended',         ended_at,
        'target_hours',  target_hours,
        'actual_hours',  actual_hours,
        'completed',     completed
      ) ORDER BY started_at DESC)
      FROM fasting_logs
      WHERE user_id = p_user_id
        AND started_at >= now() - (p_window_days || ' days')::INTERVAL
    )
  );
$$;
```

### 4.4 System Instruction Template

Gemini uses `systemInstruction` as a separate parameter, not prepended to the user message.
This keeps the prompt structure clean and reduces repeated token consumption.

```
You are a personal nutrition analyst for a single user.

USER PROFILE:
- Eating pattern: 16:8 intermittent fasting, 2 meals per day
- Diet style: primarily meat-based and Bulgarian dairy
  (kashkaval cheese, kiselo mlyako yoghurt)
- Occasional: oats with kiselo mlyako and homemade honey
- Logging precision: portion estimates — treat all gram weights
  as approximations (±15%)
- Goals: body composition improvement (weight and body fat % tracked)
- Language: respond in the same language the user writes in

ANALYTICAL GUIDELINES:
- Answer questions analytically and concisely; do not moralise or hedge
- When data is insufficient, state exactly what is missing
- Treat all nutritional values as estimates unless stated otherwise
- Reference specific dates when making trend claims
- Bulgarian food names may appear alongside English names — treat them
  as equivalent (e.g. "Кашкавал" = "Kashkaval")
- Portion descriptions like "large piece" or "handful" are intentional;
  estimate gram equivalents for calculations and note the assumption
- Do not repeat the raw data back to the user; interpret and summarise it

The raw log data is provided as a JSON object in the user's message.
```

### 4.5 Edge Function: `/gemini`

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
- Logging precision: portion estimates — treat gram weights as approximations (±15%)
- Goals: body composition improvement (weight and body fat % tracked)
- Language: respond in the same language the user writes in

ANALYTICAL GUIDELINES:
- Answer analytically and concisely; do not moralise or hedge
- When data is insufficient, state exactly what is missing
- Reference specific dates when making trend claims
- Bulgarian food names may appear alongside English names — treat as equivalent
- Portion descriptions are intentional; estimate gram equivalents and note assumption
- Do not repeat raw data back to the user; interpret and summarise it
`.trim();

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  // --- Parse request ---
  const body = await req.json();
  const question: string = body.question?.trim();
  const windowDays: number = body.window_days ?? 14;

  if (!question) {
    return new Response(
      JSON.stringify({ error: "question is required" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- Assemble context ---
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

  // --- Cache check ---
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
        "X-Cache": "HIT"
      }
    });
  }

  // --- Call Gemini with streaming ---
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const userMessage = `
Here is my nutrition log data (JSON):
${contextJson}

My question: ${question}
  `.trim();

  const streamResult = await model.generateContentStream(userMessage);

  // Stream response back to client
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let fullText = "";
    let totalTokens = 0;

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      await writer.write(encoder.encode(chunkText));
    }

    // Get usage metadata from final response
    const finalResponse = await streamResult.response;
    totalTokens = (finalResponse.usageMetadata?.totalTokenCount) ?? 0;

    // Store in cache
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
      "X-Cache": "MISS"
    }
  });
});
```

### 4.6 Token Budget Estimate

| Component | Estimated Tokens |
|---|---|
| System instruction | ~300 |
| 14-day meal log (28 meals × ~150 tokens) | ~4,200 |
| Daily totals (14 rows) | ~600 |
| Body metrics (30 days) | ~400 |
| Fasting logs (14 days) | ~300 |
| User question | ~50 |
| **Total input** | **~5,850** |
| Gemini response | ~500 |
| **Total per query** | **~6,350 tokens** |

At 1,500 free requests/day, the effective daily token budget is **~9.5 billion tokens** —
the context window size is the only practical constraint, and 6,350 tokens per query is
0.6% of the 1M token window.

### 4.7 Caching Strategy

Cache TTL is 1 hour. The same question asked twice within an hour against the same data
window returns the cached response instantly. This eliminates redundant API calls for
rapid back-and-forth questioning sessions.

### 4.8 Pre-built Prompt Suggestions (Quick Chips)

These appear as tappable chips in the chat UI. They are complete questions, not templates:

```typescript
export const QUICK_PROMPTS = [
  "Summarise my nutrition for the past 7 days.",
  "What was my average daily protein this week?",
  "How consistent have I been with my 16:8 fasting?",
  "On which days did I overeat compared to my usual pattern?",
  "How has my weight trended over the past 30 days?",
] as const;
```

### 4.9 Mobile Client: Gemini Chat Hook

```typescript
// hooks/useGeminiChat.ts
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export function useGeminiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (question: string) => {
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setIsStreaming(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/gemini`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ question, window_days: 14 }),
      }
    );

    if (!response.ok || !response.body) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = "Failed to get a response. Please try again.";
        return updated;
      });
      setIsStreaming(false);
      return;
    }

    // Read stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content += chunk;
        return updated;
      });
    }

    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isStreaming, sendMessage, clearMessages };
}
```

---

## 5. API Specification

All standard CRUD uses `supabase-js` directly from the client.
Custom logic uses Edge Functions.

### 5.1 Standard Supabase Client Operations

#### Log a meal

```typescript
// lib/meals.ts
import { supabase } from "./supabase";
import { MealItemInput, NutritionCalc } from "@/types";

export async function logMeal(
  mealIndex: 1 | 2,
  items: MealItemInput[],
  notes?: string
) {
  // 1. Create meal record
  const { data: meal, error: mealError } = await supabase
    .from("meals")
    .insert({
      logged_at: new Date().toISOString(),
      meal_index: mealIndex,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (mealError) throw mealError;

  // 2. Calculate and insert items in batch
  const mealItems = items.map(item => ({
    meal_id: meal.id,
    food_id: item.foodId ?? null,
    food_name: item.foodName,
    food_name_local: item.foodNameLocal ?? null,
    amount_g: item.amountG ?? null,
    portion_desc: item.portionDesc ?? null,
    calories: item.amountG
      ? (item.caloriesPer100g * item.amountG) / 100
      : item.estimatedCalories,
    protein_g: item.amountG
      ? (item.proteinPer100g * item.amountG) / 100
      : item.estimatedProtein,
    fat_g: item.amountG
      ? (item.fatPer100g * item.amountG) / 100
      : item.estimatedFat,
    carbs_g: item.amountG
      ? (item.carbsPer100g * item.amountG) / 100
      : item.estimatedCarbs,
    fiber_g: item.amountG
      ? (item.fiberPer100g * item.amountG) / 100
      : item.estimatedFiber,
  }));

  const { error: itemsError } = await supabase
    .from("meal_items")
    .insert(mealItems);

  if (itemsError) throw itemsError;

  // 3. Increment use_count for each logged food
  for (const item of items.filter(i => i.foodId)) {
    await supabase.rpc("increment_food_use_count", { p_food_id: item.foodId });
  }

  return meal;
}
```

**Zod validation schema:**

```typescript
// schemas/validation.ts
import { z } from "zod";

export const MealItemInputSchema = z.object({
  foodId:          z.string().uuid().optional(),
  foodName:        z.string().min(1, "Food name is required"),
  foodNameLocal:   z.string().optional(),
  amountG:         z.number().positive().optional(),
  portionDesc:     z.string().optional(),
  caloriesPer100g: z.number().min(0),
  proteinPer100g:  z.number().min(0),
  fatPer100g:      z.number().min(0),
  carbsPer100g:    z.number().min(0),
  fiberPer100g:    z.number().min(0),
  estimatedCalories: z.number().min(0).optional(),
  estimatedProtein:  z.number().min(0).optional(),
  estimatedFat:      z.number().min(0).optional(),
  estimatedCarbs:    z.number().min(0).optional(),
  estimatedFiber:    z.number().min(0).optional(),
}).refine(
  d => d.amountG !== undefined || d.portionDesc !== undefined,
  { message: "Either amountG or portionDesc is required" }
);
```

#### Retrieve daily summary

```typescript
const { data } = await supabase
  .from("daily_summaries")
  .select("*")
  .eq("log_date", new Date().toISOString().split("T")[0])
  .single();
```

#### Retrieve weekly trends

```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
  .toISOString().split("T")[0];

const { data } = await supabase
  .from("daily_summaries")
  .select("log_date, total_calories, total_protein_g, total_fat_g, total_carbs_g")
  .gte("log_date", sevenDaysAgo)
  .order("log_date", { ascending: true });
```

#### Frequent foods (quick-log chips)

```typescript
const { data } = await supabase
  .from("foods")
  .select("*")
  .order("use_count", { ascending: false })
  .limit(10);
```

#### Log body metrics

```typescript
await supabase.from("body_metrics").insert({
  recorded_at:  new Date().toISOString(),
  weight_kg:    82.5,
  body_fat_pct: 18.2,
});
```

#### Start / end fasting window

```typescript
// Start fast
await supabase.from("fasting_logs").insert({
  started_at:   new Date().toISOString(),
  target_hours: 16,
});

// End fast (find active)
const { data: activeFast } = await supabase
  .from("fasting_logs")
  .select("id")
  .is("ended_at", null)
  .order("started_at", { ascending: false })
  .limit(1)
  .single();

if (activeFast) {
  await supabase
    .from("fasting_logs")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", activeFast.id);
}
```

### 5.2 Edge Function Endpoints

#### `POST /functions/v1/gemini`

| Field | Value |
|---|---|
| Auth | `Authorization: Bearer <supabase_access_token>` |
| Content-Type | `application/json` |
| Body | `{ "question": string, "window_days": number (optional, default 14) }` |
| Response | `text/plain` streaming |
| Header `X-Cache` | `HIT` or `MISS` |

**Error responses:**
- `401` — missing or invalid auth token
- `405` — non-POST request
- `422` — missing `question` field
- `500` — context assembly or Gemini API failure (body contains detail)

---

#### `POST /functions/v1/export`

| Field | Value |
|---|---|
| Auth | `Authorization: Bearer <supabase_access_token>` |
| Body | `{ "format": "markdown" \| "csv", "days": number (optional, default 30) }` |
| Response | `text/markdown` or `text/csv` with `Content-Disposition: attachment` |

---

## 6. UI/UX Specification

### 6.1 Navigation Structure

```
Tab Bar (bottom, 4 tabs):
├── Log        — Quick meal logging (default tab)
├── Today      — Daily summary, macros, fasting timer
├── Insights   — Gemini AI chat
└── Profile    — Body metrics, settings, fasting control, export
```

### 6.2 Screen Specifications

---

#### Screen 1: Quick Log (`/log`)

**Purpose:** Log a meal in under 15 seconds for a regular food.

**Layout:**
```
┌──────────────────────────────┐
│  Meal 1  ·  13:42        [✎] │  ← meal index auto-detected; tap to override
├──────────────────────────────┤
│  🔍  Search foods...         │  ← auto-focused on screen mount
├──────────────────────────────┤
│  FREQUENT                    │
│  ┌──────────┐ ┌──────────┐   │
│  │Kashkaval │ │ Chicken  │   │  ← chips sorted by use_count DESC
│  └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐   │
│  │Kiselo ml.│ │   Eggs   │   │
│  └──────────┘ └──────────┘   │
├──────────────────────────────┤
│  SELECTED (2)                │
│  Kashkaval    [  100 ] g  ▸  │  ← inline numeric input; ▸ opens portion picker
│               370 kcal       │
│  Chicken br.  [  250 ] g  ▸  │
│               413 kcal       │
│               ─────────────  │
│               783 kcal total │
├──────────────────────────────┤
│  [       LOG MEAL       ]    │  ← primary action
└──────────────────────────────┘
```

**Interaction rules:**
- Tap frequent food chip → adds to selected list with default 100g
- Tap amount field → numeric keyboard opens immediately (no modal navigation)
- Tap ▸ → opens bottom sheet with portion presets ("small", "medium", "large") mapped
  to gram estimates for that specific food
- Swipe left on selected item → remove with confirmation haptic
- Search: debounced 200ms, queries GIN index on `name`
- "LOG MEAL" → optimistic insert → success haptic + toast → clears selection
- Meal index auto-detection: before 15:00 → meal_index 1; after 15:00 → meal_index 2

---

#### Screen 2: Today (`/today`)

**Purpose:** Daily nutritional status at a glance.

**Layout:**
```
┌──────────────────────────────┐
│  Sunday, 29 March            │
├──────────────────────────────┤
│                              │
│        ╭───────────╮         │
│        │  1,847    │         │  ← calorie ring (Victory Native)
│        │   kcal    │         │     outer arc = target (configurable)
│        ╰───────────╯         │
│                              │
│  ████░░  P 162g              │  ← macro progress bars
│  █████░  F  78g              │
│  ██░░░░  C  42g              │
├──────────────────────────────┤
│  MEALS                       │
│  ┌────────────────────────┐  │
│  │ Meal 1 · 13:15    ✎   │  │  ← tap to expand / edit
│  │ Kashkaval · Chicken   │  │
│  │ 783 kcal              │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Meal 2 · 19:30    ✎   │  │
│  │ Beef mince · Eggs     │  │
│  │ 1,064 kcal            │  │
│  └────────────────────────┘  │
├──────────────────────────────┤
│  FASTING                     │
│  ████████████░░░░  13.8/16h  │  ← live countdown, updates every minute
│  Started 20:15 last night    │
└──────────────────────────────┘
```

**Interaction rules:**
- Pull to refresh → invalidates TanStack Query cache
- Tap meal card → expands inline to show all items with edit/delete per item
- Tap edit item → inline amount field opens (no navigation)
- Fasting bar: reads `started_at` from Supabase on mount, computes elapsed locally

---

#### Screen 3: Insights (`/insights`)

**Purpose:** On-demand AI analysis of nutrition data via Gemini.

**Layout:**
```
┌──────────────────────────────┐
│  Insights                [✕] │  ← ✕ clears conversation
├──────────────────────────────┤
│                              │
│  ╭──────────────────────╮   │
│  │ What was my protein  │   │  ← user message (right-aligned)
│  │ average this week?   │   │
│  ╰──────────────────────╯   │
│                              │
│  ╭──────────────────────╮   │
│  │ Your average protein │   │  ← AI response (left-aligned, streams in)
│  │ over the past 7 days │   │
│  │ was 168g/day. Highest│   │
│  │ on Tuesday (214g)... │   │
│  ╰──────────────────────╯   │
│                              │
├──────────────────────────────┤
│  Quick prompts:              │
│  [Weekly summary]            │  ← chips populate input field
│  [Protein average]           │
│  [Fasting adherence]         │
│  [Overeating days]           │
│  [Weight trend]              │
├──────────────────────────────┤
│  ┌──────────────────── [▶] ┐ │
│  │  Ask anything...        │ │
│  └─────────────────────────┘ │
└──────────────────────────────┘
```

**Interaction rules:**
- Send → calls Edge Function → response streams character-by-character into chat bubble
- While streaming: input is disabled, send button shows spinner
- Quick chips → populate input field; user can edit before sending
- Chat history lives in component state only; not persisted between app sessions
- Error state: displays "Could not reach AI. Check connection." inline in chat

---

#### Screen 4: Profile (`/profile`)

Sub-sections rendered as a single scrollable screen:

**4a — Body Metrics**
```
Weight:       [ 82.5 ] kg
Body fat:     [ 18.2 ] %
              [ LOG METRICS ]

Recent weight:
▁▂▃▃▂▂▁  sparkline (14 days, Victory Native)
82.1 → 82.5 kg
```

**4b — Fasting**
```
[ START FAST ]  /  [ END FAST 13h 42m ]  ← toggle based on active state

Last 7 fasts:
✓ 16.2h  ✓ 15.8h  ✗ 12.1h  ✓ 16.0h ...
```

**4c — Reminders**
Configurable time pickers for each of the 4 notification types.
Times stored in `AsyncStorage` (device-local, no server needed).

**4d — Targets** (optional)
Calorie target input → used for ring chart goal arc.
Macro targets (protein/fat/carbs in grams) → used for macro bar targets.

**4e — Export**
```
[ Export Markdown (last 30 days) ]
[ Export CSV (last 30 days)      ]
```

---

### 6.3 Notification Schedule

| ID | Default time | Message |
|---|---|---|
| `meal_1_reminder` | 12:30 | "Time to break your fast. Log your first meal." |
| `meal_2_reminder` | 18:30 | "Second meal window. Don't skip logging." |
| `fast_start` | 20:30 | "Eating window closed. Start your fast." |
| `morning_weight` | 08:00 | "Log your weight before eating." |

All messages configurable. Notifications are scheduled locally via Expo Notifications
(`scheduleNotificationAsync` with `DailyTriggerInput`) — no server involvement.

---

## 7. Performance Optimization

### 7.1 Database Index Strategy

| Index | Purpose |
|---|---|
| `idx_foods_use_count DESC` | Frequent foods list in O(1) |
| `idx_foods_name (GIN)` | Full-text food search |
| `idx_meals_user_logged DESC` | Date-range meal queries |
| `idx_meal_items_meal_id` | Meal expansion without full scan |
| `idx_body_metrics_user_date DESC` | Metrics history queries |
| `idx_fasting_user_date DESC` | Fasting history queries |
| `idx_cache_hash` | Cache lookup in O(log n) |

### 7.2 Query Optimisation

- `daily_summaries` view prevents re-aggregation on every dashboard open
- AI context assembled in a **single SQL function call** — no N+1 queries
- Frequent foods list fetched once at app start and held in Zustand for the session
- TanStack Query caches daily summary with a 5-minute stale time

### 7.3 Token Efficiency

- Context window limited to 14 days by default; pass `window_days: 1` for simple
  "what did I eat today?" queries
- Compact JSON serialisation (no whitespace) in context assembly
- 1-hour cache TTL on AI responses eliminates duplicate API calls in rapid sessions

### 7.4 Client Performance

- Optimistic updates: meal appears in Today list before server confirms
- Food library (10–20 items) held in Zustand — zero-latency chip rendering
- Supabase Realtime subscription on `daily_summaries` updates totals without polling
- No image assets in the app — icon-only UI

### 7.5 Gemini Rate Limit Handling

Free tier: 15 requests per minute. At human typing speed, this is never reached.
Implement exponential backoff in the Edge Function for the rare case of rapid consecutive
requests:

```typescript
// Retry logic inside Edge Function
async function callGeminiWithRetry(model, prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await model.generateContentStream(prompt);
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}
```

---

## 8. Development Plan

### Phase 1 — Minimal Viable Logging System

**Objective:** Log a meal and see today's totals.

**Deliverables:**
- [ ] Supabase project created; all migrations applied; types generated
- [ ] Auth configured (magic link; single user only)
- [ ] Personal food library seeded (10 foods)
- [ ] Expo project initialised (SDK 52, new arch, TypeScript strict)
- [ ] `supabase-js` client configured with session persistence
- [ ] Quick Log screen: food chip selection + amount entry + submit
- [ ] Today screen: calorie total + macro totals (no chart yet)
- [ ] Meal list on Today screen with expand/collapse
- [ ] Zod validation on all inputs

**Acceptance criteria:**
- Can log a meal with 2 foods in under 20 seconds
- Today screen shows correct calorie and macro totals
- Data persists after app close and restart

**Technical risks:**
- Expo new architecture + Victory Native compatibility → check Victory Native v41 release
  notes before starting; if incompatible, use `react-native-svg` charts directly
- Supabase RLS blocking inserts → test policies with service role key first, then anon key

---

### Phase 2 — Analytics Layer

**Objective:** Weekly trends, body metrics, fasting tracker, notifications.

**Deliverables:**
- [ ] `daily_summaries` view verified against real data
- [ ] Calorie ring chart on Today screen (Victory Native `VictoryPie`)
- [ ] Macro progress bars on Today screen
- [ ] Weekly calorie trend line chart (Victory Native `VictoryLine`)
- [ ] Body metrics input and weight sparkline
- [ ] Fasting start/stop with live countdown timer
- [ ] Fasting history list (last 7 entries)
- [ ] Expo Notifications scheduler with all 4 reminder types
- [ ] Notification time configuration UI in Profile screen

**Acceptance criteria:**
- Weekly trend chart renders correctly for 7 days of data
- Fasting timer survives app backgrounding and device restart
- Notifications fire at configured times on physical Samsung S25

**Technical risks:**
- Android 14 exact alarm permission required for reliable notifications →
  add `USE_EXACT_ALARM` to `app.json` permissions; test on device early
- Fasting timer drift when backgrounded → store `started_at` in Supabase,
  compute elapsed on foreground resume rather than running a JS interval

---

### Phase 3 — Gemini AI Integration

**Objective:** On-demand AI insights via chat interface.

**Deliverables:**
- [ ] `assemble_ai_context` Postgres function deployed and tested with sample data
- [ ] Edge Function `/gemini` deployed with streaming and caching
- [ ] `ai_insights_cache` table functional; cache hit rate logged
- [ ] Insights screen with streaming response rendering
- [ ] 5 quick prompt chips
- [ ] Edge Function `/export` deployed (markdown + CSV)
- [ ] Export buttons in Profile screen

**Acceptance criteria:**
- Cached response returns in under 500ms
- Fresh Gemini response begins streaming within 3 seconds
- Streamed text renders without visible jank on Samsung S25
- Export produces valid markdown/CSV file saved to device

**Technical risks:**
- `ReadableStream` on React Native (Expo) — use `fetch` with `response.body.getReader()`;
  avoid `EventSource` (Android SSE support is inconsistent)
- Supabase Edge Function cold start on free tier (~300ms) — acceptable; show loading
  indicator immediately on send to mask latency

---

### Phase 4 — Polish and Optimisations

**Objective:** Production-quality feel; optimistic updates; full configurability.

**Deliverables:**
- [ ] Optimistic meal insert via TanStack Query mutation
- [ ] Food search with GIN full-text (replace substring match)
- [ ] Calorie and macro target inputs in Profile
- [ ] Ring chart goal arc based on calorie target
- [ ] Macro bar targets based on macro targets
- [ ] Error boundaries on all screens
- [ ] Offline graceful degradation messaging
- [ ] App icon and splash screen (Expo `app.json`)
- [ ] Exercise logging screen (basic: name, duration, calories burned)
- [ ] `increment_food_use_count` Postgres RPC function

**Acceptance criteria:**
- Meal appears in Today list within 100ms of tapping "Log Meal"
- Food search returns results within 300ms
- App does not crash on Supabase connection failure

---

### Claude Code Usage Strategy

Claude Code is best leveraged phase by phase, with this specification as the primary
context document. Recommended session structure:

1. **Session 1 (Phase 1):** Feed Section 3 (schema) → generate migration SQL.
   Run `supabase gen types typescript` → feed output back → generate all query hooks.

2. **Session 2 (Phase 1 continued):** Feed Section 6 screens 1 & 2 → scaffold Quick Log
   and Today components. Feed Section 5 client operations → generate `lib/meals.ts`
   and all TanStack Query hooks.

3. **Session 3 (Phase 3):** Feed Section 4.5 (Edge Function code) → Claude Code
   reviews, completes, and writes tests. Feed Section 4.9 (chat hook) → generate
   Insights screen.

4. **Ongoing:** Use Claude Code for debugging by providing the full spec section + the
   failing component. The spec gives Claude Code sufficient context to reason about
   intent, not just syntax.

---

## 9. Extensibility Strategy

### 9.1 Exercise Tracking

`exercises` table already exists. Additions required:
- Exercise library table (analogous to `foods`)
- Exercise Log screen (analogous to Quick Log)
- Net calories field in `daily_summaries` view: `total_calories - COALESCE(calories_burned, 0)`
- Include exercises in AI context assembly query

Estimated effort: **1–2 days.**

### 9.2 Photo-Based Meal Logging

Gemini natively supports image input via `inlineData` with `image/jpeg` MIME type.
Integration path:

1. User takes photo in Quick Log (Expo Camera)
2. Photo uploaded to Supabase Storage; URL stored in `meals.photo_url`
3. Edge Function fetches photo bytes, base64-encodes them
4. Sends to Gemini with prompt: *"Identify the foods in this image and estimate
   gram quantities for each. Return JSON array of {food_name, amount_g, calories}."*
5. App receives suggested `meal_items` pre-populated for user confirmation

Schema addition: `photo_url TEXT` on `meals`. No other schema changes.
Estimated effort: **1–2 days.**

### 9.3 Barcode Scanning

Use `expo-camera` barcode scanning mode. On scan:
1. Query Open Food Facts API (free, no key) with EAN barcode
2. If found: normalise to `foods` schema, insert, proceed to log
3. If not found: prompt manual entry

Low priority given home-cooked diet. Estimated effort: **1 day.**

### 9.4 Wearable Integration (Samsung Health)

Requires a native module wrapping the Samsung Health SDK (Android only), which requires
ejecting from Expo managed to bare workflow. Defer until all other features are stable.
Estimated effort: **3–5 days.**

### 9.5 Upgrading AI Model

To upgrade from `gemini-2.0-flash` to `gemini-1.5-pro` for sessions requiring deeper
reasoning, change one constant in the Edge Function:

```typescript
const MODEL_NAME = "gemini-1.5-pro"; // 50 free req/day — sufficient for occasional use
```

No other changes required. The prompt structure and context format are model-agnostic.

### 9.6 Switching AI Providers (Future)

The AI integration is fully contained in the Edge Function. Switching to Claude API,
OpenAI, or a local Ollama instance requires:
- Swapping the SDK import
- Updating the API call pattern (same prompt content)
- Updating `GEMINI_API_KEY` env var to the new provider's key

Zero mobile client changes. Zero schema changes.

---

## Appendix A — Environment Variables

```bash
# ─── Mobile Client (safe to expose — Supabase anon key is public by design) ───
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ─── Supabase Edge Functions (server-side only — stored in Supabase vault) ────
GEMINI_API_KEY=AIzaSy...              # From Google AI Studio
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Never expose publicly
```

**Obtaining the Gemini API key:**
1. Go to https://aistudio.google.com
2. Sign in with Google account
3. Click "Get API key" → "Create API key"
4. Copy key → add to Supabase Edge Function secrets via:
   `supabase secrets set GEMINI_API_KEY=AIzaSy...`

---

## Appendix B — File Structure

```
nutrition-tracker/
├── app/                          # Expo Router screens
│   ├── (tabs)/
│   │   ├── log.tsx               # Quick Log
│   │   ├── today.tsx             # Daily Summary
│   │   ├── insights.tsx          # Gemini AI Chat
│   │   └── profile.tsx           # Metrics + Settings + Export
│   └── _layout.tsx
├── components/
│   ├── FoodChip.tsx
│   ├── MacroBar.tsx
│   ├── CalorieRing.tsx
│   ├── FastingTimer.tsx
│   └── StreamingText.tsx         # Gemini response renderer
├── lib/
│   ├── supabase.ts               # Supabase client singleton
│   ├── gemini.ts                 # Edge Function caller helper
│   ├── notifications.ts          # Expo Notifications config
│   └── calculations.ts           # Nutrition math helpers
├── hooks/
│   ├── useDailySummary.ts        # TanStack Query hook
│   ├── useFrequentFoods.ts
│   ├── useActiveFast.ts
│   ├── useBodyMetrics.ts
│   └── useGeminiChat.ts          # AI chat state + streaming
├── store/
│   └── useAppStore.ts            # Zustand (UI state only)
├── types/
│   └── database.ts               # Generated: supabase gen types typescript
├── schemas/
│   └── validation.ts             # Zod schemas
├── supabase/
│   ├── functions/
│   │   ├── gemini/
│   │   │   └── index.ts          # AI proxy + caching
│   │   └── export/
│   │       └── index.ts          # Markdown + CSV export
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_views.sql
│       ├── 003_functions.sql     # assemble_ai_context, increment_food_use_count
│       └── 004_seed_foods.sql
└── constants/
    └── prompts.ts                # QUICK_PROMPTS array
```

---

## Appendix C — Getting Started (First-Time Setup)

```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase

# 2. Initialise project
supabase init
supabase login
supabase link --project-ref <your-project-ref>

# 3. Apply migrations
supabase db push

# 4. Generate TypeScript types
supabase gen types typescript --linked > types/database.ts

# 5. Set Edge Function secrets
supabase secrets set GEMINI_API_KEY=AIzaSy...

# 6. Deploy Edge Functions
supabase functions deploy gemini
supabase functions deploy export

# 7. Initialise Expo app
npx create-expo-app nutrition-tracker --template blank-typescript
cd nutrition-tracker
npx expo install @supabase/supabase-js @tanstack/react-query zustand
npx expo install victory-native expo-notifications expo-router nativewind

# 8. Run on device
npx expo run:android
```