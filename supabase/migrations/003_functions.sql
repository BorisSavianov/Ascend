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
