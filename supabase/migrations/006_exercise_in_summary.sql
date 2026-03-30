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
    SELECT ROUND(SUM(e.calories_burned)::NUMERIC, 1)
    FROM exercises e
    WHERE e.user_id = m.user_id
      AND DATE(e.logged_at) = DATE(MIN(m.logged_at))
  ), 0)                                            AS exercise_calories_burned,
  ROUND(
    SUM(mi.calories) - COALESCE((
      SELECT SUM(e.calories_burned)
      FROM exercises e
      WHERE e.user_id = m.user_id
        AND DATE(e.logged_at) = DATE(MIN(m.logged_at))
    ), 0)
  , 1)                                             AS net_calories
FROM meals m
JOIN meal_items mi ON mi.meal_id = m.id
GROUP BY m.user_id, DATE(m.logged_at);
