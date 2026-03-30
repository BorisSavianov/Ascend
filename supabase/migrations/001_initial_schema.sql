CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- foods
CREATE TABLE foods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- meals
CREATE TABLE meals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid(),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  meal_index  SMALLINT NOT NULL DEFAULT 1,
  meal_label  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meals_user_logged ON meals(user_id, logged_at DESC);
CREATE INDEX idx_meals_date ON meals(user_id, CAST(timezone('UTC', logged_at) AS date));

-- meal_items
CREATE TABLE meal_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- body_metrics
CREATE TABLE body_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg       NUMERIC(5,2),
  body_fat_pct    NUMERIC(5,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_body_metrics_user_date ON body_metrics(user_id, recorded_at DESC);

-- fasting_logs
CREATE TABLE fasting_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- exercises
CREATE TABLE exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ai_insights_cache
CREATE TABLE ai_insights_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Row Level Security
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
