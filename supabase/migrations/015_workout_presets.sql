-- ── 1. Drop old tables (cascade handles FK children) ──────────────────────────
DROP TABLE IF EXISTS workout_day_exercises CASCADE;
DROP TABLE IF EXISTS workout_days          CASCADE;
DROP TABLE IF EXISTS workout_programs      CASCADE;

-- ── 2. New tables ─────────────────────────────────────────────────────────────

-- User-defined named workout templates
CREATE TABLE workout_presets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL DEFAULT auth.uid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workout_presets_user ON workout_presets(user_id);

-- Exercises within a preset, with per-preset defaults
CREATE TABLE workout_preset_exercises (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id            UUID     NOT NULL REFERENCES workout_presets(id) ON DELETE CASCADE,
  exercise_template_id UUID     NOT NULL REFERENCES exercise_templates(id),
  sort_order           SMALLINT NOT NULL DEFAULT 1,
  default_sets         SMALLINT NOT NULL DEFAULT 2,
  default_reps_min     SMALLINT NOT NULL DEFAULT 10,
  default_reps_max     SMALLINT NOT NULL DEFAULT 12,
  default_weight_kg    NUMERIC(6,2)
);
CREATE INDEX idx_wpe_preset ON workout_preset_exercises(preset_id);

-- Maps weekday slot (0=Sun…6=Sat) to a preset; NULL = rest/ad-hoc
CREATE TABLE day_assignments (
  user_id     UUID     NOT NULL DEFAULT auth.uid(),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  preset_id   UUID     REFERENCES workout_presets(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, day_of_week)
);

-- ── 3. Modify workout_sessions ────────────────────────────────────────────────
ALTER TABLE workout_sessions
  DROP COLUMN IF EXISTS workout_day_id;

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS preset_id        UUID        REFERENCES workout_presets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status           TEXT        CHECK (status IN ('active', 'paused', 'completed')),
  ADD COLUMN IF NOT EXISTS session_snapshot JSONB;

-- Backfill status: completed sessions get 'completed', open sessions get 'active'.
-- This migration is part of a clean-break redesign (no data preservation required),
-- but the backfill is correct for any environment with existing rows.
UPDATE workout_sessions SET status = 'completed' WHERE ended_at IS NOT NULL;
UPDATE workout_sessions SET status = 'active'    WHERE ended_at IS NULL;
ALTER TABLE workout_sessions ALTER COLUMN status SET NOT NULL;
ALTER TABLE workout_sessions ALTER COLUMN status SET DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_workout_sessions_preset ON workout_sessions(preset_id, date DESC);

-- ── 4. Add optional cardio→session link ───────────────────────────────────────
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE SET NULL;

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE workout_presets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_preset_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_assignments          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns_row" ON workout_presets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_owns_via_preset" ON workout_preset_exercises
  FOR ALL USING (
    preset_id IN (SELECT id FROM workout_presets WHERE user_id = auth.uid())
  ) WITH CHECK (
    preset_id IN (SELECT id FROM workout_presets WHERE user_id = auth.uid())
  );

CREATE POLICY "user_owns_row" ON day_assignments
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 6. New seed function (replaces seed_workout_program) ──────────────────────
CREATE OR REPLACE FUNCTION seed_workout_presets(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_push UUID; v_pull UUID; v_legs UUID; v_shoulders UUID;
BEGIN
  INSERT INTO workout_presets (user_id, name) VALUES (p_user_id, 'Push Day')      RETURNING id INTO v_push;
  INSERT INTO workout_presets (user_id, name) VALUES (p_user_id, 'Pull Day')      RETURNING id INTO v_pull;
  INSERT INTO workout_presets (user_id, name) VALUES (p_user_id, 'Legs & Arms')   RETURNING id INTO v_legs;
  INSERT INTO workout_presets (user_id, name) VALUES (p_user_id, 'Shoulders Day') RETURNING id INTO v_shoulders;

  -- Push Day: Incline Chest Press, Seated Chest Fly, Overhead Triceps Ext, Tricep Pushdown
  INSERT INTO workout_preset_exercises (preset_id, exercise_template_id, sort_order, default_sets, default_reps_min, default_reps_max)
  VALUES
    (v_push, '00000000-0000-0000-0001-000000000002', 1, 2, 10, 12),
    (v_push, '00000000-0000-0000-0001-000000000005', 2, 2, 12, 15),
    (v_push, '00000000-0000-0000-0001-000000000008', 3, 2, 10, 12),
    (v_push, '00000000-0000-0000-0001-000000000011', 4, 2, 10, 12);

  -- Pull Day: Lat Pulldown, Seated Row, Preacher Curl, Hammer Curl
  INSERT INTO workout_preset_exercises (preset_id, exercise_template_id, sort_order, default_sets, default_reps_min, default_reps_max)
  VALUES
    (v_pull, '00000000-0000-0000-0001-000000000001', 1, 2, 10, 12),
    (v_pull, '00000000-0000-0000-0001-000000000004', 2, 2, 10, 12),
    (v_pull, '00000000-0000-0000-0001-000000000009', 3, 2, 10, 12),
    (v_pull, '00000000-0000-0000-0001-000000000012', 4, 2, 10, 12);

  -- Legs & Arms: Hack Squat, Leg Extension, Lying Leg Curl, Bayesian Curl
  INSERT INTO workout_preset_exercises (preset_id, exercise_template_id, sort_order, default_sets, default_reps_min, default_reps_max)
  VALUES
    (v_legs, '00000000-0000-0000-0001-000000000013', 1, 2,  8, 12),
    (v_legs, '00000000-0000-0000-0001-000000000003', 2, 2, 12, 15),
    (v_legs, '00000000-0000-0000-0001-000000000006', 3, 2, 10, 12),
    (v_legs, '00000000-0000-0000-0001-000000000014', 4, 2, 10, 12);

  -- Shoulders Day: Shoulder Press, Lateral Raise, Seated Reverse Fly
  INSERT INTO workout_preset_exercises (preset_id, exercise_template_id, sort_order, default_sets, default_reps_min, default_reps_max)
  VALUES
    (v_shoulders, '00000000-0000-0000-0001-000000000007', 1, 2,  8, 12),
    (v_shoulders, '00000000-0000-0000-0001-000000000010', 2, 2, 10, 12),
    (v_shoulders, '00000000-0000-0000-0001-000000000015', 3, 2, 12, 15);

  -- Day assignments: Wed=Pull, Thu=Shoulders, Sat=Push, Sun=Legs, rest=NULL
  INSERT INTO day_assignments (user_id, day_of_week, preset_id) VALUES
    (p_user_id, 0, v_legs),
    (p_user_id, 1, NULL),
    (p_user_id, 2, NULL),
    (p_user_id, 3, v_pull),
    (p_user_id, 4, v_shoulders),
    (p_user_id, 5, NULL),
    (p_user_id, 6, v_push);
END;
$$;

-- ── 7. Permissions ────────────────────────────────────────────────────────────
GRANT ALL ON workout_presets, workout_preset_exercises, day_assignments
  TO anon, authenticated;
