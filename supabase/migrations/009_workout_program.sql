-- 009_workout_program.sql
-- Program-based strength training tables

-- Global exercise catalog (no user_id — shared, immutable templates)
CREATE TABLE exercise_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  muscle_group      TEXT        NOT NULL,     -- 'back' | 'chest' | 'quads' | 'hamstrings' | 'shoulders' | 'triceps' | 'biceps' | 'rear_delts'
  equipment         TEXT        NOT NULL,     -- 'machine' | 'cable' | 'barbell' | 'dumbbell' | 'bodyweight'
  image_key         TEXT,                     -- maps to constants/exerciseImages.ts key
  target_sets       SMALLINT    NOT NULL DEFAULT 2,
  target_reps_min   SMALLINT    NOT NULL DEFAULT 10,
  target_reps_max   SMALLINT    NOT NULL DEFAULT 12,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User's workout program (one active program per user)
CREATE TABLE workout_programs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL DEFAULT auth.uid(),
  name       TEXT        NOT NULL DEFAULT 'My Program',
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workout_programs_user ON workout_programs(user_id);

-- Days in a program
-- day_of_week: 0=Sun, 1=Mon, ..., 6=Sat (matches JavaScript Date.getDay())
CREATE TABLE workout_days (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID     NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  name        TEXT     NOT NULL,
  is_rest_day BOOLEAN  NOT NULL DEFAULT FALSE,
  UNIQUE(program_id, day_of_week)
);
CREATE INDEX idx_workout_days_program ON workout_days(program_id);

-- Exercises assigned to a day, with optional per-day overrides of template targets
CREATE TABLE workout_day_exercises (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id       UUID     NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_template_id UUID     NOT NULL REFERENCES exercise_templates(id),
  sort_order           SMALLINT NOT NULL DEFAULT 1,
  target_sets          SMALLINT,       -- NULL = use exercise_template default
  target_reps_min      SMALLINT,
  target_reps_max      SMALLINT
);
CREATE INDEX idx_wde_day ON workout_day_exercises(workout_day_id);

-- A single workout session instance
CREATE TABLE workout_sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL DEFAULT auth.uid(),
  workout_day_id UUID        NOT NULL REFERENCES workout_days(id),
  date           DATE        NOT NULL DEFAULT CURRENT_DATE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at       TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workout_sessions_user ON workout_sessions(user_id, date DESC);
CREATE INDEX idx_workout_sessions_day  ON workout_sessions(workout_day_id, date DESC);

-- Each exercise instance within a session
CREATE TABLE logged_exercises (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID     NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_template_id UUID     NOT NULL REFERENCES exercise_templates(id),
  sort_order           SMALLINT NOT NULL DEFAULT 1
);
CREATE INDEX idx_logged_exercises_session ON logged_exercises(session_id);

-- Individual sets within a logged exercise
CREATE TABLE logged_sets (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_exercise_id UUID         NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
  set_number         SMALLINT     NOT NULL,
  weight_kg          NUMERIC(6,2),
  reps               SMALLINT,
  rpe                NUMERIC(3,1) CHECK (rpe IS NULL OR (rpe >= 6 AND rpe <= 10)),
  is_completed       BOOLEAN      NOT NULL DEFAULT FALSE,
  completed_at       TIMESTAMPTZ,
  notes              TEXT
);
CREATE INDEX idx_logged_sets_exercise ON logged_sets(logged_exercise_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE exercise_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_programs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_day_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE logged_exercises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE logged_sets           ENABLE ROW LEVEL SECURITY;

-- exercise_templates: globally readable, no client-side writes
CREATE POLICY "templates_readable" ON exercise_templates
  FOR SELECT USING (TRUE);

-- workout_programs: user owns their own programs
CREATE POLICY "user_owns_row" ON workout_programs
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- workout_days: access via program ownership
CREATE POLICY "user_owns_via_program" ON workout_days
  FOR ALL USING (
    program_id IN (
      SELECT id FROM workout_programs WHERE user_id = auth.uid()
    )
  );

-- workout_day_exercises: access via day → program ownership
CREATE POLICY "user_owns_via_day" ON workout_day_exercises
  FOR ALL USING (
    workout_day_id IN (
      SELECT wd.id FROM workout_days wd
      JOIN workout_programs wp ON wp.id = wd.program_id
      WHERE wp.user_id = auth.uid()
    )
  );

-- workout_sessions: user owns their sessions
CREATE POLICY "user_owns_row" ON workout_sessions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- logged_exercises: access via session ownership
CREATE POLICY "user_owns_via_session" ON logged_exercises
  FOR ALL USING (
    session_id IN (
      SELECT id FROM workout_sessions WHERE user_id = auth.uid()
    )
  );

-- logged_sets: access via logged_exercise → session ownership
CREATE POLICY "user_owns_via_logged_exercise" ON logged_sets
  FOR ALL USING (
    logged_exercise_id IN (
      SELECT le.id FROM logged_exercises le
      JOIN workout_sessions ws ON ws.id = le.session_id
      WHERE ws.user_id = auth.uid()
    )
  );
