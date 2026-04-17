-- 016_fix_assemble_full_context.sql
-- Update assemble_full_context to use the new workout_presets schema
-- (workout_days / workout_day_id were dropped in 015_workout_presets.sql)

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
      SELECT json_agg(meal_obj)
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
        ORDER BY m.logged_at DESC
      ) sub
    ),

    'workout_sessions', (
      SELECT json_agg(json_build_object(
        'date',        ws.date,
        'preset_name', wp.name,
        'started_at',  ws.started_at,
        'ended_at',    ws.ended_at,
        'notes',       ws.notes,
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
      LEFT JOIN workout_presets wp ON wp.id = ws.preset_id
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
          AND recorded_at >= now() - (p_window_days || ' days')::INTERVAL
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
