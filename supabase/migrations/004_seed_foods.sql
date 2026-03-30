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
