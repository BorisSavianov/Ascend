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
