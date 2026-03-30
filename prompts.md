# Claude Code Prompts — Personal Nutrition Tracker
**4 phases · Implementation-ready · Feed one at a time**

---

# PHASE 1 PROMPT
## Minimal Viable Logging System

---

```
You are building a personal nutrition tracking mobile application. This is a single-user app — there is no multi-tenancy requirement. Optimise every decision for speed of logging, code simplicity, and long-term maintainability.

You will implement Phase 1 of 4. Do not implement anything beyond the Phase 1 scope defined below.

---

## STACK

- Expo SDK 52+ with React Native new architecture enabled
- TypeScript 5.x in strict mode throughout — no `any` types
- Expo Router v4 for file-system routing
- Supabase (PostgreSQL + supabase-js v2) for data storage and auth
- TanStack Query v5 for server state management
- Zustand v4 for local UI state
- NativeWind v4 for styling
- Zod v3 for input validation

---

## SUPABASE PROJECT SETUP

Create the following directory and file structure for Supabase:

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_views.sql
│   ├── 003_functions.sql
│   └── 004_seed_foods.sql
└── config.toml  (already exists from supabase init)
```

---

## MIGRATION 001 — Initial Schema

Write `supabase/migrations/001_initial_schema.sql` with the following tables:

### foods
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE foods (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL DEFAULT auth.uid(),
  name                TEXT NOT NULL,
  name_local          TEXT,
  brand               TEXT,
  barcode             TEXT,
  calories_per_100g   NUMERIC(7,2) NOT NULL,
  protein_per_100g    NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_per_100g        NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_per_100g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  fiber_per_100g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  sugar_per_100g      NUMERIC(6,2),
  sodium_per_100g     NUMERIC(7,2),
  is_custom           BOOLEAN NOT NULL DEFAULT TRUE,
  use_count           INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_foods_user_id ON foods(user_id);
CREATE INDEX idx_foods_use_count ON foods(use_count DESC);
CREATE INDEX idx_foods_name ON foods USING gin(to_tsvector('simple', name));
```

### meals
```sql
CREATE TABLE meals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL DEFAULT auth.uid(),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  meal_index  SMALLINT NOT NULL DEFAULT 1,
  meal_label  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meals_user_logged ON meals(user_id, logged_at DESC);
CREATE INDEX idx_meals_date ON meals(user_id, DATE(logged_at));
```

### meal_items
```sql
CREATE TABLE meal_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id         UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id         UUID REFERENCES foods(id) ON DELETE SET NULL,
  food_name       TEXT NOT NULL,
  food_name_local TEXT,
  amount_g        NUMERIC(7,1),
  portion_desc    TEXT,
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
  ADD CONSTRAINT chk_quantity
  CHECK (amount_g IS NOT NULL OR portion_desc IS NOT NULL);
```

### body_metrics
```sql
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
```

### fasting_logs
```sql
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
```

### exercises
```sql
CREATE TABLE exercises (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  name            TEXT NOT NULL,
  category        TEXT,
  duration_min    SMALLINT,
  calories_burned NUMERIC(6,1),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_user_date ON exercises(user_id, logged_at DESC);
```

### ai_insights_cache
```sql
CREATE TABLE ai_insights_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  context_hash    TEXT NOT NULL,
  question        TEXT NOT NULL,
  response        TEXT NOT NULL,
  model           TEXT NOT NULL,
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, context_hash)
);

CREATE INDEX idx_cache_hash ON ai_insights_cache(user_id, context_hash);
```

### Row Level Security
```sql
ALTER TABLE foods              ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_metrics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fasting_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights_cache  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns_row" ON foods
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON meals
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_meal_items" ON meal_items
  FOR ALL USING (
    meal_id IN (SELECT id FROM meals WHERE user_id = auth.uid())
  );
CREATE POLICY "user_owns_row" ON body_metrics
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON fasting_logs
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON exercises
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_owns_row" ON ai_insights_cache
  FOR ALL USING (user_id = auth.uid());
```

---

## MIGRATION 002 — Views

Write `supabase/migrations/002_views.sql`:

```sql
CREATE VIEW daily_summaries AS
SELECT
  m.user_id,
  DATE(m.logged_at)                                        AS log_date,
  COUNT(DISTINCT m.id)                                     AS meal_count,
  ROUND(SUM(mi.calories)::NUMERIC, 1)                      AS total_calories,
  ROUND(SUM(mi.protein_g)::NUMERIC, 1)                     AS total_protein_g,
  ROUND(SUM(mi.fat_g)::NUMERIC, 1)                         AS total_fat_g,
  ROUND(SUM(mi.carbs_g)::NUMERIC, 1)                       AS total_carbs_g,
  ROUND(SUM(mi.fiber_g)::NUMERIC, 1)                       AS total_fiber_g,
  ROUND(
    SUM(mi.calories) / NULLIF(
      SUM(mi.protein_g + mi.fat_g + mi.carbs_g), 0
    )::NUMERIC, 2
  )                                                        AS calorie_density,
  MIN(m.logged_at)                                         AS first_meal_at,
  MAX(m.logged_at)                                         AS last_meal_at
FROM meals m
JOIN meal_items mi ON mi.meal_id = m.id
GROUP BY m.user_id, DATE(m.logged_at);
```

---

## MIGRATION 003 — Functions

Write `supabase/migrations/003_functions.sql`:

```sql
CREATE OR REPLACE FUNCTION increment_food_use_count(p_food_id UUID)
RETURNS void
LANGUAGE SQL
AS $$
  UPDATE foods SET use_count = use_count + 1 WHERE id = p_food_id;
$$;

CREATE OR REPLACE FUNCTION assemble_ai_context(
  p_user_id    UUID,
  p_window_days INTEGER DEFAULT 14
)
RETURNS JSON
LANGUAGE SQL
STABLE
AS $$
  SELECT json_build_object(
    'generated_at', now(),
    'window_days',  p_window_days,

    'meals', (
      SELECT json_agg(meal_obj ORDER BY (meal_obj->>'logged_at') DESC)
      FROM (
        SELECT json_build_object(
          'date',          DATE(m.logged_at),
          'time',          TO_CHAR(m.logged_at, 'HH24:MI'),
          'meal_index',    m.meal_index,
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

---

## MIGRATION 004 — Seed Foods

Write `supabase/migrations/004_seed_foods.sql`.

IMPORTANT: This seed must run as the authenticated user so RLS passes. Wrap in a function that accepts the user_id and call it after first sign-in from the app, OR use the service role via a one-time script. For now, write it as a parameterised function:

```sql
CREATE OR REPLACE FUNCTION seed_personal_foods(p_user_id UUID)
RETURNS void
LANGUAGE SQL
AS $$
  INSERT INTO foods (
    user_id, name, name_local,
    calories_per_100g, protein_per_100g, fat_per_100g,
    carbs_per_100g, fiber_per_100g, notes
  ) VALUES
    (p_user_id, 'Kashkaval',        'Кашкавал',      370, 26.0, 29.0,  1.5,  0,    'Bulgarian yellow cheese'),
    (p_user_id, 'Kiselo mlyako',    'Кисело мляко',   63,  3.5,  3.5,  4.7,  0,    '3.6% fat standard'),
    (p_user_id, 'Oats',             'Овесени ядки',  389, 17.0,  7.0, 66.0, 10.6,  'dry weight'),
    (p_user_id, 'Homemade honey',   'Домашен мед',   304,  0.3,  0.0, 82.4,  0.2,  'local, unprocessed'),
    (p_user_id, 'Chicken breast',   'Пилешки гърди', 165, 31.0,  3.6,  0.0,  0,    'raw weight'),
    (p_user_id, 'Beef mince 80/20', 'Телешка кайма', 254, 17.0, 20.0,  0.0,  0,    'raw weight'),
    (p_user_id, 'Pork neck',        'Свинска плешка',230, 16.0, 18.0,  0.0,  0,    'raw weight'),
    (p_user_id, 'Eggs',             'Яйца',          143, 13.0, 10.0,  0.7,  0,    'large, ~60g each'),
    (p_user_id, 'Olive oil',        'Зехтин',        884,  0.0,100.0,  0.0,  0,    NULL),
    (p_user_id, 'Butter',           'Масло',         717,  0.9, 81.0,  0.1,  0,    NULL)
  ON CONFLICT DO NOTHING;
$$;
```

---

## EXPO PROJECT STRUCTURE

Create the following file structure. Do not deviate from it:

```
app/
├── _layout.tsx              — root layout with TanStack Query provider + auth guard
├── (auth)/
│   └── login.tsx            — magic link login screen
└── (tabs)/
    ├── _layout.tsx          — bottom tab bar
    ├── log.tsx              — Quick Log screen
    ├── today.tsx            — Daily Summary screen
    ├── insights.tsx         — placeholder only (Phase 3)
    └── profile.tsx          — placeholder only (Phase 2)

components/
├── FoodChip.tsx
├── MealItemRow.tsx
├── MacroRow.tsx
└── EmptyState.tsx

hooks/
├── useFrequentFoods.ts
├── useDailySummary.ts
├── useTodayMeals.ts
└── useLogMeal.ts

lib/
├── supabase.ts
└── calculations.ts

schemas/
└── validation.ts

store/
└── useAppStore.ts

types/
└── database.ts              — generated by supabase gen types typescript

constants/
└── foods.ts                 — portion presets
```

---

## IMPLEMENTATION REQUIREMENTS

### lib/supabase.ts
- Use `createClient` from `@supabase/supabase-js`
- Read URL and anon key from `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Configure auth storage using `AsyncStorage` from `@react-native-async-storage/async-storage`
- Export a single `supabase` client instance
- Export a typed `Database` type from `types/database.ts`

### lib/calculations.ts
Write pure functions (no side effects, fully typed):
```typescript
// Calculate nutrition for a given gram amount
calculateNutrition(food: Food, amountG: number): NutritionValues

// Determine meal index from current time
// Before 15:00 → 1, after → 2
getMealIndexFromTime(date?: Date): 1 | 2

// Sum nutrition across an array of meal items
sumNutrition(items: MealItem[]): NutritionValues

// Format calories for display: 1847 → "1,847"
formatCalories(cal: number): string

// Format grams for display: 162.4 → "162g"
formatGrams(g: number): string
```

### schemas/validation.ts
Write Zod schemas:
```typescript
MealItemInputSchema  — validates a single food selection before insert
LogMealInputSchema   — validates the full meal log payload
```

Rules:
- `amountG` OR `portionDesc` must be present (use `.refine()`)
- `calories` must be ≥ 0
- `mealIndex` must be 1 or 2

### store/useAppStore.ts
Zustand store managing:
```typescript
{
  // Quick log screen state
  selectedItems: MealItemDraft[]
  addItem: (item: MealItemDraft) => void
  updateItemAmount: (id: string, amountG: number) => void
  removeItem: (id: string) => void
  clearItems: () => void
}
```
`MealItemDraft` is a local-only type (not from the DB) that holds all fields needed to render the selected list and compute totals before submission.

### hooks/useFrequentFoods.ts
- TanStack Query `useQuery`
- Fetches top 10 foods ordered by `use_count DESC`
- `staleTime: 5 * 60 * 1000` (5 minutes — food library rarely changes)
- Returns `{ data: Food[], isLoading, error }`

### hooks/useDailySummary.ts
- TanStack Query `useQuery`
- Fetches from `daily_summaries` view for today's date
- `staleTime: 60 * 1000` (1 minute)
- Returns `{ data: DailySummary | null, isLoading, error }`

### hooks/useTodayMeals.ts
- TanStack Query `useQuery`
- Fetches all meals + meal_items for today
- Join: `meals` with nested `meal_items` using Supabase's nested select syntax:
  `supabase.from('meals').select('*, meal_items(*)')`
- Filter by today's date range
- Returns `{ data: MealWithItems[], isLoading, error }`

### hooks/useLogMeal.ts
- TanStack Query `useMutation`
- On mutate:
  1. Insert into `meals`
  2. Batch insert into `meal_items`
  3. Call `increment_food_use_count` RPC for each food with a `food_id`
- On success:
  1. Invalidate `['daily_summaries']` query
  2. Invalidate `['today_meals']` query
  3. Call `clearItems()` on the Zustand store
- On error: do NOT clear items (user should be able to retry)
- Implement optimistic update: add a temporary meal to the `today_meals` cache immediately

---

## SCREEN: Quick Log (`app/(tabs)/log.tsx`)

This is the primary screen. Optimise it for speed above all else.

### Layout (top to bottom):
1. **Header row**: "Meal 1" or "Meal 2" (auto-detected from time via `getMealIndexFromTime()`). Tapping the label opens an `ActionSheet` to manually override to 1 or 2.
2. **Search input**: `TextInput` with placeholder "Search foods...". Auto-focus on screen mount using `useEffect` + `ref.current?.focus()`. Debounce input 200ms before querying Supabase with `ilike` on `name`.
3. **Frequent foods grid**: Horizontal scrollable row of `FoodChip` components. Shown when search input is empty. Hidden when user is typing.
4. **Search results list**: `FlatList` of food items. Shown only when search is active. Each row shows name, calories per 100g, and a "+" button.
5. **Selected items list**: Shows each item in `selectedItems` from the Zustand store. Each row:
   - Food name
   - `TextInput` for gram amount (numeric keyboard, no decimal pad — amounts are whole numbers)
   - Computed calorie count (updates live as amount changes)
   - Swipe-to-delete via `react-native-gesture-handler` `Swipeable`
6. **Total bar**: Pinned above keyboard. Shows sum of calories across all selected items.
7. **LOG MEAL button**: Disabled when `selectedItems` is empty. Calls `useLogMeal` mutation. Shows loading spinner while pending.

### FoodChip component:
- Rounded pill button
- Shows food `name` (not `name_local`)
- On press: adds food to `selectedItems` with default `amountG: 100`
- If food already in `selectedItems`: pressing again increments amount by 100g (not adds a duplicate)

### MealItemRow component:
- Props: `item: MealItemDraft`, `onAmountChange: (id, g) => void`, `onRemove: (id) => void`
- Amount input updates the Zustand store on `onChangeText`
- Calorie display recalculates on every amount change using `calculateNutrition`

---

## SCREEN: Today (`app/(tabs)/today.tsx`)

### Layout (top to bottom):
1. **Date header**: "Sunday, 29 March" — formatted with `date-fns`
2. **Calorie total**: Large number. Show "—" if no meals logged today.
3. **Macro summary row**: Three columns — Protein, Fat, Carbs. Each shows value in grams. No charts in Phase 1 (added in Phase 2).
4. **Meals section**: Heading "MEALS". Renders a card per meal using `useTodayMeals` data. Each card:
   - Meal index label ("Meal 1", "Meal 2")
   - Time (formatted from `logged_at`)
   - Comma-separated food names (truncate to 3, then "and N more")
   - Total calories for that meal
   - Chevron to expand
   - Expanded state: full list of meal items with amounts and individual calorie counts
   - Delete meal button (with confirmation alert)
5. **Empty state**: Shown when no meals logged. Use `EmptyState` component with message "No meals logged today. Tap Log to start."
6. **Pull to refresh**: `RefreshControl` on scroll view — invalidates `daily_summaries` and `today_meals` queries.

---

## SCREEN: Login (`app/(auth)/login.tsx`)

Simple magic link auth:
- Email input (keyboard type `email-address`)
- "Send Login Link" button
- On submit: calls `supabase.auth.signInWithOtp({ email })`
- Success state: "Check your email for a login link."
- Error state: display error message inline

### Auth guard in `app/_layout.tsx`:
- On mount: check `supabase.auth.getSession()`
- If no session: redirect to `/(auth)/login`
- If session exists: redirect to `/(tabs)/log`
- Subscribe to `supabase.auth.onAuthStateChange` and update navigation accordingly

### First-time setup after login:
After a successful first login, check if the user has any foods in their library. If `foods` count is 0, call `supabase.rpc('seed_personal_foods', { p_user_id: user.id })` automatically.

---

## ENVIRONMENT

Create `.env.local` with placeholders and a `.env.example` file:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create `app.config.ts` (not `app.json`) that reads these env vars and exposes them to Expo.

---

## PACKAGE.JSON DEPENDENCIES

Install exactly these packages. Do not install anything not listed:

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "react-native": "0.76.x",
    "@supabase/supabase-js": "^2.0.0",
    "@react-native-async-storage/async-storage": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.0.0",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.0.0",
    "zod": "^3.0.0",
    "date-fns": "^3.0.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-safe-area-context": "^4.0.0",
    "react-native-screens": "^4.0.0"
  }
}
```

---

## CODE QUALITY RULES

Apply these rules to every file without exception:

1. TypeScript strict mode — no implicit `any`, no non-null assertions without comment
2. All Supabase query results must be typed using the generated `Database` type
3. All async functions must handle errors — no unhandled promise rejections
4. No inline styles — use NativeWind classes exclusively
5. No `console.log` in production paths — use a `__DEV__` guard if logging is needed
6. Every component file exports exactly one component as default export
7. Hooks are the only files that import from Supabase directly — screens import hooks only

---

## ACCEPTANCE CRITERIA

Phase 1 is complete when:

- [ ] `supabase db push` applies all 4 migrations without errors
- [ ] `supabase gen types typescript --linked > types/database.ts` produces a non-empty file
- [ ] Magic link login works on a physical device (Samsung S25 or emulator)
- [ ] After first login, food library is seeded with 10 foods
- [ ] Tapping 2 food chips and logging a meal takes under 20 seconds
- [ ] Today screen shows correct calorie and macro totals immediately after logging
- [ ] Pulling to refresh on Today screen re-fetches and updates data
- [ ] Deleting a meal from Today screen updates the totals correctly
- [ ] App state survives a full device restart (auth session persists)
- [ ] No TypeScript errors on `npx tsc --noEmit`
```

---

---

# PHASE 2 PROMPT
## Analytics Layer

---

```
You are continuing development of a personal nutrition tracking app. Phase 1 is complete: the schema is applied, auth works, meals can be logged, and the Today screen shows raw totals.

Phase 2 adds: charts, body metrics, fasting tracker, and notifications.

Do not modify any existing Phase 1 files unless a specific change is listed below. Only add new files and extend existing screens.

---

## STACK ADDITIONS

Install these additional packages:

```json
{
  "victory-native": "^41.0.0",
  "expo-notifications": "~0.29.0",
  "expo-haptics": "~13.0.0",
  "@shopify/react-native-skia": "*"
}
```

Note: `victory-native` v41+ requires `@shopify/react-native-skia`. Install it as a peer dependency via `npx expo install @shopify/react-native-skia`.

---

## NEW FILES TO CREATE

```
hooks/
├── useWeeklyTrends.ts
├── useBodyMetrics.ts
├── useLogBodyMetrics.ts
├── useActiveFast.ts
├── useFastingHistory.ts
└── useStartFast.ts, useEndFast.ts

components/
├── CalorieRing.tsx
├── MacroBar.tsx
├── WeeklyChart.tsx
├── WeightSparkline.tsx
├── FastingTimer.tsx
└── FastingHistoryRow.tsx

lib/
└── notifications.ts

constants/
└── notifications.ts
```

---

## CHARTS — Victory Native

### CalorieRing (`components/CalorieRing.tsx`)

A circular progress ring showing today's calories vs target.

Props:
```typescript
{
  consumed: number    // today's calories
  target: number      // from app settings (default 2000 if not set)
  size?: number       // diameter in px, default 180
}
```

Implementation:
- Use `VictoryPie` from `victory-native` with 2 slices: consumed vs remaining
- If consumed > target: ring fills completely and changes colour to indicate over-target
- Show `consumed` value as large text in the centre
- Show "kcal" as small label below the number
- Use Skia canvas renderer (required for Victory Native v41)

### MacroBar (`components/MacroBar.tsx`)

Horizontal segmented bar showing macro split.

Props:
```typescript
{
  proteinG: number
  fatG: number
  carbsG: number
  targets?: { protein: number; fat: number; carbs: number }
}
```

Implementation:
- Three coloured segments proportional to calorie contribution:
  - Protein: 4 kcal/g
  - Carbs: 4 kcal/g
  - Fat: 9 kcal/g
- Below bar: three columns showing actual grams + target grams if targets provided
- Distinct colours per macro — not generic grey. Suggested: protein = warm amber, fat = slate blue, carbs = sage green. Use CSS variables / NativeWind theme tokens.

### WeeklyChart (`components/WeeklyChart.tsx`)

Props:
```typescript
{
  data: { log_date: string; total_calories: number }[]
}
```

Implementation:
- `VictoryLine` + `VictoryScatter` (dots on data points)
- X axis: day abbreviations (Mon, Tue...)
- Y axis: calorie values, auto-scaled
- Horizontal dashed reference line at calorie target (from app settings)
- Animate on mount

### WeightSparkline (`components/WeightSparkline.tsx`)

Props:
```typescript
{
  data: { date: string; weight_kg: number }[]
}
```

Implementation:
- Compact `VictoryLine` (no axes, no labels)
- Height: 40px, full width of container
- Show first and last weight values as text labels at each end

---

## HOOKS

### useWeeklyTrends.ts
- `useQuery` fetching from `daily_summaries`
- Last 7 days
- `staleTime: 5 * 60 * 1000`

### useBodyMetrics.ts
- `useQuery` fetching last 30 body_metrics records ordered DESC

### useLogBodyMetrics.ts
- `useMutation` inserting into `body_metrics`
- On success: invalidate `['body_metrics']`

### useActiveFast.ts
- `useQuery` fetching the single fasting_log where `ended_at IS NULL`
- `staleTime: 0` — always fresh (fast state is critical)
- Returns `{ data: FastingLog | null }`

### useFastingHistory.ts
- `useQuery` fetching last 7 fasting_logs ordered by `started_at DESC`

### useStartFast.ts
- `useMutation` inserting into `fasting_logs` with `started_at: now()` and `target_hours: 16`
- On success: invalidate `['active_fast']`

### useEndFast.ts
- `useMutation` updating the active fast's `ended_at` to `now()`
- On success: invalidate `['active_fast']`, `['fasting_history']`

---

## NOTIFICATIONS

### lib/notifications.ts

```typescript
import * as Notifications from 'expo-notifications';

// Request permissions — call on first app launch after login
export async function requestNotificationPermissions(): Promise<boolean>

// Schedule all 4 reminder types based on stored times
// Cancels existing scheduled notifications first, then reschedules
export async function scheduleAllReminders(config: NotificationConfig): Promise<void>

// Cancel all scheduled reminders
export async function cancelAllReminders(): Promise<void>

// Get current scheduled notifications for display in settings
export async function getScheduledReminders(): Promise<Notifications.NotificationRequest[]>
```

### constants/notifications.ts

```typescript
export type NotificationId =
  | 'meal_1_reminder'
  | 'meal_2_reminder'
  | 'fast_start'
  | 'morning_weight';

export type NotificationConfig = {
  meal_1_reminder: { hour: number; minute: number; enabled: boolean };
  meal_2_reminder: { hour: number; minute: number; enabled: boolean };
  fast_start:      { hour: number; minute: number; enabled: boolean };
  morning_weight:  { hour: number; minute: number; enabled: boolean };
};

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  meal_1_reminder: { hour: 12, minute: 30, enabled: true },
  meal_2_reminder: { hour: 18, minute: 30, enabled: true },
  fast_start:      { hour: 20, minute: 30, enabled: true },
  morning_weight:  { hour: 8,  minute: 0,  enabled: true },
};

export const NOTIFICATION_MESSAGES: Record<NotificationId, { title: string; body: string }> = {
  meal_1_reminder: {
    title: 'Time to eat.',
    body:  'Break your fast. Log your first meal.'
  },
  meal_2_reminder: {
    title: 'Second meal window.',
    body:  "Don't skip logging."
  },
  fast_start: {
    title: 'Eating window closed.',
    body:  'Start your fast.'
  },
  morning_weight: {
    title: 'Log your weight.',
    body:  'Before eating. Takes 10 seconds.'
  },
};
```

Store `NotificationConfig` in `AsyncStorage` with key `@notification_config`.

---

## STORE ADDITIONS (useAppStore.ts)

Extend the existing Zustand store with:

```typescript
{
  // Settings
  calorieTarget: number            // default 2000
  macroTargets: {
    protein: number                // default 160
    fat: number                    // default 80
    carbs: number                  // default 100
  }
  notificationConfig: NotificationConfig

  // Actions
  setCalorieTarget: (kcal: number) => void
  setMacroTargets: (targets: MacroTargets) => void
  setNotificationConfig: (config: NotificationConfig) => void
}
```

Persist this section of the store to `AsyncStorage` using Zustand's `persist` middleware with key `@app_settings`.

---

## SCREEN UPDATES

### Today screen (`app/(tabs)/today.tsx`) — EXTEND

Replace the Phase 1 plain calorie number and macro text with:
1. `CalorieRing` component (centred, below date header)
2. `MacroBar` component (below ring)
3. `WeeklyChart` component at the bottom of the screen (below meals list)

The meals list and pull-to-refresh remain unchanged.

### Profile screen (`app/(tabs)/profile.tsx`) — IMPLEMENT (was placeholder)

Four sections rendered as a single `ScrollView`:

**Section 1 — Body Metrics**
- Two `TextInput` fields: Weight (kg) and Body fat (%)
- "LOG METRICS" button → calls `useLogBodyMetrics` mutation
- Shows validation error if both fields are empty
- `WeightSparkline` below, showing last 14 days
- Below sparkline: "X kg → Y kg" showing first and last values in range

**Section 2 — Fasting**
- `FastingTimer` component:
  - If no active fast: large "START FAST" button
  - If active fast: shows elapsed time in HH:MM format, updating every 60 seconds, plus "END FAST" button
  - Progress bar: elapsed hours / 16 target hours
  - Elapsed time computed from `started_at` fetched from Supabase — NOT a JS timer that drifts
- `FastingHistoryRow` list: last 7 fasts showing duration and ✓/✗ completion status

**Section 3 — Targets**
- Calorie target: `TextInput` (numeric), default 2000
- Protein target (g): `TextInput` (numeric), default 160
- Fat target (g): `TextInput` (numeric), default 80
- Carbs target (g): `TextInput` (numeric), default 100
- "SAVE TARGETS" button → updates Zustand + AsyncStorage

**Section 4 — Notifications**
- Toggle + time picker row for each of the 4 notification types
- Use `DateTimePicker` from `@react-native-community/datetimepicker` (time mode only)
- "SAVE REMINDERS" button → calls `scheduleAllReminders(config)`
- Show confirmation toast on save

**Section 5 — Export** (UI only in Phase 2, actual export implemented in Phase 3)
- Two disabled buttons: "Export Markdown" and "Export CSV"
- Label them "(Available in next update)" — no functionality yet

---

## FastingTimer component (`components/FastingTimer.tsx`)

Props:
```typescript
{
  activeFast: FastingLog | null
  targetHours: number               // always 16
  onStart: () => void
  onEnd: () => void
  isStarting: boolean
  isEnding: boolean
}
```

Elapsed time calculation:
```typescript
// Do NOT use setInterval to count up — use a 60-second interval
// that re-reads the stored started_at and computes fresh elapsed time
// This survives background, device restart, and timezone changes

useEffect(() => {
  if (!activeFast) return;
  const interval = setInterval(() => {
    const elapsedMs = Date.now() - new Date(activeFast.started_at).getTime();
    setElapsedHours(elapsedMs / 3_600_000);
  }, 60_000);
  return () => clearInterval(interval);
}, [activeFast?.started_at]);
```

---

## NOTIFICATION PERMISSIONS

In `app/_layout.tsx`, after a successful auth session is confirmed, add:

```typescript
import { requestNotificationPermissions } from '@/lib/notifications';

// After session confirmed:
const granted = await requestNotificationPermissions();
if (granted) {
  const config = await getStoredNotificationConfig(); // from AsyncStorage
  await scheduleAllReminders(config);
}
```

Also add to `app.json`/`app.config.ts`:
```json
{
  "android": {
    "permissions": ["USE_EXACT_ALARM", "RECEIVE_BOOT_COMPLETED"]
  }
}
```

---

## ACCEPTANCE CRITERIA

Phase 2 is complete when:

- [ ] Calorie ring renders on Today screen with correct consumed / target values
- [ ] Macro bar renders with correct proportions
- [ ] Weekly chart renders with last 7 days of data (or gracefully empty)
- [ ] Body metrics can be logged and appear in weight sparkline
- [ ] Fasting start/stop works correctly
- [ ] Fasting elapsed time is correct after closing and reopening the app
- [ ] Fasting history shows last 7 entries with correct ✓/✗ status
- [ ] All 4 notifications fire at their configured times on a physical device
- [ ] Notification times are configurable in Profile screen
- [ ] Calorie and macro targets persist between app restarts
- [ ] No TypeScript errors on `npx tsc --noEmit`
- [ ] No Victory Native Skia rendering errors on Android
```

---

---

# PHASE 3 PROMPT
## Gemini AI Integration

---

```
You are continuing development of a personal nutrition tracking app. Phases 1 and 2 are complete.

Phase 3 adds: Gemini AI chat interface and data export. All AI calls are proxied through a Supabase Edge Function — the API key never touches the mobile client.

---

## PREREQUISITES

Before starting, confirm:
- The `assemble_ai_context` Postgres function exists (from migration 003)
- The `ai_insights_cache` table exists (from migration 001)
- Supabase CLI is authenticated and linked to the project

---

## ENVIRONMENT VARIABLES

Add to Supabase Edge Function secrets:

```bash
supabase secrets set GEMINI_API_KEY=AIzaSy...
```

The mobile client does NOT receive this key. It uses only the Supabase anon key and its own JWT to call Edge Functions.

---

## SUPABASE EDGE FUNCTION: /gemini

Create `supabase/functions/gemini/index.ts`:

```typescript
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

  // Auth
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

  // Parse and validate body
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

  // Assemble context
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

  // Cache check (1 hour TTL)
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

  // Call Gemini
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

  // Stream response to client, cache on completion
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

Deploy with: `supabase functions deploy gemini`

---

## SUPABASE EDGE FUNCTION: /export

Create `supabase/functions/export/index.ts`:

```typescript
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

  // Fetch all data
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

  // Group meals by date
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

Deploy with: `supabase functions deploy export`

---

## MOBILE: Gemini API Helper

Create `lib/gemini.ts`:

```typescript
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
  } catch (err) {
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
  } catch (err) {
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

---

## HOOK: useGeminiChat.ts

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
            updated.pop(); // Remove empty assistant bubble
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

---

## SCREEN: Insights (`app/(tabs)/insights.tsx`) — IMPLEMENT (was placeholder)

### Layout:

```
SafeAreaView
└── View (flex: 1, column)
    ├── Header row
    │   ├── Text "Insights"
    │   └── TouchableOpacity "Clear" (shown only if messages.length > 0)
    │
    ├── FlatList (flex: 1, messages)
    │   └── ChatBubble per message
    │       - User: right-aligned, accent colour background
    │       - Assistant: left-aligned, surface colour background
    │       - If isStreaming && content === "": show animated dots (3 pulsing dots)
    │       - If isStreaming && content !== "": render content as-is (partial stream)
    │
    ├── ErrorBanner (shown if error !== null)
    │   └── Text with error message + dismiss button
    │
    ├── QuickPrompts ScrollView (horizontal, shown when messages.length === 0)
    │   └── Chips for each QUICK_PROMPT constant
    │       On press: populate input but do not send (let user review first)
    │
    └── InputRow (keyboard-avoiding, pinned to bottom)
        ├── TextInput (multiline, max 4 lines, placeholder "Ask anything...")
        └── SendButton
            - Disabled when: input is empty OR isStreaming is true
            - Shows ActivityIndicator when isStreaming
            - On press: sendMessage(inputText); clear input
```

### constants/prompts.ts

```typescript
export const QUICK_PROMPTS = [
  "Summarise my nutrition for the past 7 days.",
  "What was my average daily protein this week?",
  "How consistent have I been with my 16:8 fasting?",
  "On which days did I overeat compared to my usual pattern?",
  "How has my weight trended over the past 30 days?",
] as const;
```

---

## SCREEN UPDATE: Profile screen — Export buttons

Remove the "(Available in next update)" labels from the export buttons.

Implement them:
1. On press → call `triggerExport(format, 30)` from `lib/gemini.ts`
2. Use `expo-sharing` to share the resulting blob as a file
3. Show `ActivityIndicator` on the button while export is in progress
4. Handle error with an `Alert.alert` on failure

Install `expo-sharing` and `expo-file-system` (needed to write the blob to a temp file before sharing).

Export flow:
```typescript
const blob = await triggerExport("markdown", 30);
const fileUri = FileSystem.cacheDirectory + "nutrition-export.md";
// Convert blob to base64 and write via FileSystem.writeAsStringAsync
await Sharing.shareAsync(fileUri);
```

---

## ACCEPTANCE CRITERIA

Phase 3 is complete when:

- [ ] `supabase functions deploy gemini` succeeds without errors
- [ ] `supabase functions deploy export` succeeds without errors
- [ ] Sending a question in the Insights screen returns a streaming response
- [ ] Response begins appearing within 5 seconds of sending
- [ ] Response streams character by character without UI jank
- [ ] Sending the same question twice within 1 hour returns the cached response (verify via X-Cache: HIT header in network logs)
- [ ] Quick prompt chips populate the input field on tap
- [ ] Clear button removes all messages
- [ ] Error banner appears if the device has no internet connection
- [ ] "Export Markdown" button produces a downloadable .md file via share sheet
- [ ] "Export CSV" button produces a downloadable .csv file via share sheet
- [ ] Exported file contains correct data for the last 30 days
- [ ] No TypeScript errors on `npx tsc --noEmit`
```

---

---

# PHASE 4 PROMPT
## Polish and Optimisations

---

```
You are completing the final phase of a personal nutrition tracking app. Phases 1, 2, and 3 are complete and fully working.

Phase 4 adds: optimistic updates, full-text food search, exercise logging, app icon, and production hardening. No new major features — only quality improvements and completion of minor items deferred from earlier phases.

---

## 1. OPTIMISTIC MEAL INSERT

Update `hooks/useLogMeal.ts` to implement a full optimistic update.

When the mutation fires:
1. Snapshot the current `today_meals` query cache
2. Immediately add a temporary meal object to the cache with a temporary ID (`temp_${Date.now()}`)
3. If the mutation fails: roll back to the snapshot
4. If the mutation succeeds: invalidate the queries (real data replaces the optimistic entry)

The optimistic meal object must include computed nutrition totals so the calorie ring and macro bar update immediately.

Implementation pattern:
```typescript
useMutation({
  mutationFn: logMeal,
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: ['today_meals'] });
    await queryClient.cancelQueries({ queryKey: ['daily_summaries'] });

    const previousMeals = queryClient.getQueryData(['today_meals']);
    const previousSummary = queryClient.getQueryData(['daily_summaries', today]);

    // Build optimistic meal
    const optimisticMeal = {
      id: `temp_${Date.now()}`,
      meal_index: variables.mealIndex,
      logged_at: new Date().toISOString(),
      notes: variables.notes ?? null,
      meal_items: variables.items.map(item => ({
        ...item,
        id: `temp_item_${Math.random()}`,
      })),
    };

    queryClient.setQueryData(['today_meals'], (old) => [...(old ?? []), optimisticMeal]);

    // Optimistically update daily summary totals
    const totals = variables.items.reduce((acc, item) => ({
      total_calories: acc.total_calories + item.calories,
      total_protein_g: acc.total_protein_g + item.protein_g,
      total_fat_g: acc.total_fat_g + item.fat_g,
      total_carbs_g: acc.total_carbs_g + item.carbs_g,
      total_fiber_g: acc.total_fiber_g + item.fiber_g,
    }), { total_calories: 0, total_protein_g: 0, total_fat_g: 0, total_carbs_g: 0, total_fiber_g: 0 });

    queryClient.setQueryData(['daily_summaries', today], (old) =>
      old
        ? {
            ...old,
            total_calories:  (old.total_calories ?? 0)  + totals.total_calories,
            total_protein_g: (old.total_protein_g ?? 0) + totals.total_protein_g,
            total_fat_g:     (old.total_fat_g ?? 0)     + totals.total_fat_g,
            total_carbs_g:   (old.total_carbs_g ?? 0)   + totals.total_carbs_g,
          }
        : old
    );

    return { previousMeals, previousSummary };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['today_meals'], context?.previousMeals);
    queryClient.setQueryData(['daily_summaries', today], context?.previousSummary);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['today_meals'] });
    queryClient.invalidateQueries({ queryKey: ['daily_summaries'] });
  },
})
```

---

## 2. FULL-TEXT FOOD SEARCH

Update the search functionality in the Quick Log screen.

Current behaviour: `ilike` substring match — works but does not use the GIN index.

New behaviour: use Postgres full-text search via the GIN index created in migration 001.

Update the Supabase query:
```typescript
// Old (substring, no index)
.ilike('name', `%${query}%`)

// New (full-text, uses GIN index)
.textSearch('name', query, { config: 'simple', type: 'websearch' })
```

`websearch` type allows partial word matching and is tolerant of typos at the prefix level — appropriate for short food names.

Also: add `name_local` to the search by creating a combined tsvector. Add this migration:

```sql
-- supabase/migrations/005_search_improvements.sql

-- Add computed search column combining English and Bulgarian names
ALTER TABLE foods
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', COALESCE(name, '')) ||
      to_tsvector('simple', COALESCE(name_local, ''))
    ) STORED;

CREATE INDEX idx_foods_search_vector ON foods USING gin(search_vector);
```

Update the query to use `search_vector`:
```typescript
.textSearch('search_vector', query, { type: 'websearch' })
```

This allows searching "каш" and matching "Кашкавал" via the Bulgarian GIN index.

---

## 3. EXERCISE LOGGING

### New table migration

```sql
-- Already exists from migration 001 (exercises table)
-- No schema changes needed
```

### New files to create:

```
hooks/
├── useExercises.ts          — useQuery for today's exercises
├── useLogExercise.ts        — useMutation to insert exercise

components/
└── ExerciseRow.tsx          — row component for exercise list

constants/
└── exercises.ts             — common exercise presets
```

### constants/exercises.ts

```typescript
export const EXERCISE_PRESETS = [
  { name: "Walking",       category: "cardio",   defaultDuration: 30, kcalPerMin: 4   },
  { name: "Running",       category: "cardio",   defaultDuration: 30, kcalPerMin: 10  },
  { name: "Cycling",       category: "cardio",   defaultDuration: 45, kcalPerMin: 8   },
  { name: "Pull-ups",      category: "strength", defaultDuration: 20, kcalPerMin: 7   },
  { name: "Push-ups",      category: "strength", defaultDuration: 15, kcalPerMin: 6   },
  { name: "Weight lifting",category: "strength", defaultDuration: 45, kcalPerMin: 6   },
  { name: "Swimming",      category: "cardio",   defaultDuration: 30, kcalPerMin: 9   },
] as const;
```

### Exercise screen

Add a new tab to the tab bar: **Move** (between Today and Insights).

Create `app/(tabs)/move.tsx`:

Layout:
1. Header: "Move · [today's date]"
2. Preset exercise chips (horizontal scroll) — same chip pattern as food quick-log
3. Selected exercise form:
   - Exercise name (pre-filled from chip selection or editable)
   - Duration (minutes) — numeric input
   - Calories burned — auto-calculated from preset `kcalPerMin × duration`, but editable
   - "LOG EXERCISE" button
4. Today's exercises list:
   - Each row: name, duration, calories burned, delete button
5. Net calories note at bottom:
   - "Net today: [total food calories] − [total exercise calories] = [net]"

### Update daily_summaries view

Add `exercise_calories_burned` to the view to support net calorie display:

```sql
-- supabase/migrations/006_exercise_in_summary.sql

CREATE OR REPLACE VIEW daily_summaries AS
SELECT
  m.user_id,
  DATE(m.logged_at)                                AS log_date,
  COUNT(DISTINCT m.id)                             AS meal_count,
  ROUND(SUM(mi.calories)::NUMERIC, 1)              AS total_calories,
  ROUND(SUM(mi.protein_g)::NUMERIC, 1)             AS total_protein_g,
  ROUND(SUM(mi.fat_g)::NUMERIC, 1)                 AS total_fat_g,
  ROUND(SUM(mi.carbs_g)::NUMERIC, 1)               AS total_carbs_g,
  ROUND(SUM(mi.fiber_g)::NUMERIC, 1)               AS total_fiber_g,
  ROUND(
    SUM(mi.calories) / NULLIF(
      SUM(mi.protein_g + mi.fat_g + mi.carbs_g), 0
    )::NUMERIC, 2
  )                                                AS calorie_density,
  MIN(m.logged_at)                                 AS first_meal_at,
  MAX(m.logged_at)                                 AS last_meal_at,
  COALESCE((
    SELECT ROUND(SUM(calories_burned)::NUMERIC, 1)
    FROM exercises e
    WHERE e.user_id = m.user_id
      AND DATE(e.logged_at) = DATE(m.logged_at)
  ), 0)                                            AS exercise_calories_burned,
  ROUND(
    SUM(mi.calories) - COALESCE((
      SELECT SUM(calories_burned)
      FROM exercises e
      WHERE e.user_id = m.user_id
        AND DATE(e.logged_at) = DATE(m.logged_at)
    ), 0)
  , 1)                                             AS net_calories
FROM meals m
JOIN meal_items mi ON mi.meal_id = m.id
GROUP BY m.user_id, DATE(m.logged_at);
```

Regenerate TypeScript types after applying this migration:
`supabase gen types typescript --linked > types/database.ts`

---

## 4. ERROR BOUNDARIES

Create `components/ErrorBoundary.tsx` as a React class component (required — hooks cannot catch render errors):

```typescript
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

type Props = { children: React.ReactNode; fallbackLabel?: string };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-lg font-semibold mb-2">Something went wrong</Text>
          <Text className="text-sm text-gray-500 mb-6 text-center">
            {this.props.fallbackLabel ?? this.state.error?.message ?? "Unknown error"}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-3 bg-black rounded-full"
          >
            <Text className="text-white font-medium">Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
```

Wrap each tab screen's root element with `<ErrorBoundary>`:
```typescript
// In each tab screen:
export default function LogScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load log screen">
      <LogScreenContent />
    </ErrorBoundary>
  );
}
```

---

## 5. OFFLINE HANDLING

In `lib/supabase.ts`, add a network status listener:

```typescript
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
```

Install: `npx expo install @react-native-community/netinfo`

Create `components/OfflineBanner.tsx`:
- Shows a fixed banner at the top of the screen when offline
- Text: "You're offline. Showing cached data."
- Colour: amber/warning
- Disappears automatically when connection is restored

Add `<OfflineBanner />` to `app/_layout.tsx` above the tab navigator.

---

## 6. HAPTIC FEEDBACK

Add haptic feedback to key interactions using `expo-haptics`:

| Interaction | Haptic type |
|---|---|
| Tap food chip (add to selection) | `Haptics.ImpactFeedbackStyle.Light` |
| Tap "LOG MEAL" | `Haptics.ImpactFeedbackStyle.Medium` |
| Swipe to delete item | `Haptics.ImpactFeedbackStyle.Light` |
| Meal logged successfully | `Haptics.NotificationFeedbackType.Success` |
| Error on log | `Haptics.NotificationFeedbackType.Error` |
| Start fast | `Haptics.ImpactFeedbackStyle.Medium` |
| End fast | `Haptics.NotificationFeedbackType.Success` |

---

## 7. APP ICON AND SPLASH SCREEN

Create `assets/`:
```
assets/
├── icon.png          — 1024×1024 px, app icon
├── splash.png        — 1284×2778 px, splash screen
└── adaptive-icon.png — 1024×1024 px, Android adaptive icon
```

Design guidelines:
- Icon: minimal, dark background, a single bold typographic element or geometric mark
- No generic food emoji or gradient blobs
- Consistent with the app's utilitarian aesthetic

Update `app.config.ts`:
```typescript
icon: "./assets/icon.png",
splash: {
  image: "./assets/splash.png",
  resizeMode: "contain",
  backgroundColor: "#0a0a0a",
},
android: {
  adaptiveIcon: {
    foregroundImage: "./assets/adaptive-icon.png",
    backgroundColor: "#0a0a0a",
  },
},
```

Use `npx expo prebuild` if targeting a bare workflow for custom native modules.

---

## 8. FINAL TYPE GENERATION

After all migrations are applied, regenerate types one final time:

```bash
supabase db push
supabase gen types typescript --linked > types/database.ts
```

Verify that `DailySummary` type now includes `exercise_calories_burned` and `net_calories`.

---

## ACCEPTANCE CRITERIA

Phase 4 is complete when:

- [ ] Tapping "LOG MEAL" updates the calorie ring within 100ms (optimistic update)
- [ ] If log fails due to network error, the optimistic entry is rolled back and items remain in the selection
- [ ] Searching "каш" returns Kashkaval (Bulgarian GIN index working)
- [ ] Searching "chicken" returns Chicken breast (English GIN index working)
- [ ] An exercise can be logged on the Move screen in under 30 seconds
- [ ] Net calories (food minus exercise) displayed correctly on Today screen
- [ ] ErrorBoundary renders gracefully on all 5 tab screens if a child throws
- [ ] Offline banner appears within 1 second of disabling Wi-Fi and mobile data
- [ ] Haptic feedback fires on all listed interactions
- [ ] App builds successfully with `npx expo build` or EAS Build
- [ ] App icon and splash screen appear correctly on Samsung S25
- [ ] No TypeScript errors on `npx tsc --noEmit`
- [ ] `supabase gen types typescript` produces types that include all 6 migrations
```