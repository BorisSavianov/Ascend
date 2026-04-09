-- 010_seed_exercises.sql
-- Global exercise template data + per-user program seeding RPC
--
-- exercise_templates use deterministic UUIDs so the seed RPC can reference them
-- by literal value. ON CONFLICT (id) DO NOTHING makes this migration idempotent.

INSERT INTO exercise_templates
  (id, name, muscle_group, equipment, image_key, target_sets, target_reps_min, target_reps_max)
VALUES
  ('00000000-0000-0000-0001-000000000001', 'Lat Pulldown',              'back',       'machine',  'lat_pulldown',              2, 10, 12),
  ('00000000-0000-0000-0001-000000000002', 'Incline Chest Press',        'chest',      'machine',  'incline_chest_press',        2, 10, 12),
  ('00000000-0000-0000-0001-000000000003', 'Leg Extension',              'quads',      'machine',  'leg_extension',              2, 12, 15),
  ('00000000-0000-0000-0001-000000000004', 'Seated Row',                 'back',       'machine',  'seated_row',                 2, 10, 12),
  ('00000000-0000-0000-0001-000000000005', 'Seated Chest Fly',           'chest',      'machine',  'seated_chest_fly',           2, 12, 15),
  ('00000000-0000-0000-0001-000000000006', 'Lying Leg Curl',             'hamstrings', 'machine',  'lying_leg_curl',             2, 10, 12),
  ('00000000-0000-0000-0001-000000000007', 'Shoulder Press',             'shoulders',  'machine',  'shoulder_press',             2,  8, 12),
  ('00000000-0000-0000-0001-000000000008', 'Overhead Triceps Extension', 'triceps',    'machine',  'overhead_triceps_extension', 2, 10, 12),
  ('00000000-0000-0000-0001-000000000009', 'Preacher Curl',              'biceps',     'machine',  'preacher_curl',              2, 10, 12),
  ('00000000-0000-0000-0001-000000000010', 'Lateral Raise',              'shoulders',  'cable',    'lateral_raise',              2, 10, 12),
  ('00000000-0000-0000-0001-000000000011', 'Tricep Pushdown',            'triceps',    'cable',    'tricep_pushdown',            2, 10, 12),
  ('00000000-0000-0000-0001-000000000012', 'Hammer Curl',                'biceps',     'dumbbell', 'hammer_curl',                2, 10, 12),
  ('00000000-0000-0000-0001-000000000013', 'Hack Squat',                 'quads',      'machine',  'hack_squat',                 2,  8, 12),
  ('00000000-0000-0000-0001-000000000014', 'Bayesian Curl',              'biceps',     'cable',    'bayesian_curl',              2, 10, 12),
  ('00000000-0000-0000-0001-000000000015', 'Seated Reverse Fly',         'rear_delts', 'machine',  'seated_reverse_fly',         2, 12, 15)
ON CONFLICT (id) DO NOTHING;

-- ── Per-user program seeding RPC ──────────────────────────────────────────────
-- Called from the app on first login (alongside seed_personal_foods).
-- Creates: 1 program → 7 workout_days → workout_day_exercises per training day.
-- day_of_week uses JS getDay() convention: 0=Sun, 1=Mon, ..., 6=Sat.

CREATE OR REPLACE FUNCTION seed_workout_program(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_program_id UUID;
  v_day_mon    UUID;
  v_day_tue    UUID;
  v_day_wed    UUID;
  v_day_thu    UUID;
  v_day_fri    UUID;
  v_day_sat    UUID;
  v_day_sun    UUID;
BEGIN
  -- Create the program
  INSERT INTO workout_programs (user_id, name, is_active)
  VALUES (p_user_id, 'My Program', TRUE)
  RETURNING id INTO v_program_id;

  -- Create all 7 days (Mon/Tue/Fri = rest, Wed/Thu/Sat/Sun = training)
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 1, 'Monday — Rest',              TRUE)  RETURNING id INTO v_day_mon;

  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 2, 'Tuesday — Rest',             TRUE)  RETURNING id INTO v_day_tue;

  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 3, 'Wednesday — Back & Chest',   FALSE) RETURNING id INTO v_day_wed;

  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 4, 'Thursday — Shoulders & Arms',FALSE) RETURNING id INTO v_day_thu;

  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 5, 'Friday — Rest',              TRUE)  RETURNING id INTO v_day_fri;

  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 6, 'Saturday — Upper Body',      FALSE) RETURNING id INTO v_day_sat;

  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 0, 'Sunday — Legs & Arms',       FALSE) RETURNING id INTO v_day_sun;

  -- Wednesday: Lat Pulldown, Incline Chest Press, Leg Extension,
  --            Seated Row, Seated Chest Fly, Lying Leg Curl
  INSERT INTO workout_day_exercises
    (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max)
  VALUES
    (v_day_wed, '00000000-0000-0000-0001-000000000001', 1, 2, 10, 12),
    (v_day_wed, '00000000-0000-0000-0001-000000000002', 2, 2,  8, 12),
    (v_day_wed, '00000000-0000-0000-0001-000000000003', 3, 2, 12, 15),
    (v_day_wed, '00000000-0000-0000-0001-000000000004', 4, 2, 10, 12),
    (v_day_wed, '00000000-0000-0000-0001-000000000005', 5, 2, 10, 12),
    (v_day_wed, '00000000-0000-0000-0001-000000000006', 6, 2, 12, 15);

  -- Thursday: Shoulder Press, Overhead Triceps Extension, Preacher Curl,
  --           Lateral Raise, Tricep Pushdown, Hammer Curl
  INSERT INTO workout_day_exercises
    (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max)
  VALUES
    (v_day_thu, '00000000-0000-0000-0001-000000000007', 1, 2,  8, 12),
    (v_day_thu, '00000000-0000-0000-0001-000000000008', 2, 2, 10, 12),
    (v_day_thu, '00000000-0000-0000-0001-000000000009', 3, 2, 10, 12),
    (v_day_thu, '00000000-0000-0000-0001-000000000010', 4, 2, 10, 12),
    (v_day_thu, '00000000-0000-0000-0001-000000000011', 5, 2, 10, 12),
    (v_day_thu, '00000000-0000-0000-0001-000000000012', 6, 2, 10, 12);

  -- Saturday: Shoulder Press, Incline Chest Press, Lat Pulldown,
  --           Lateral Raise, Seated Reverse Fly, Seated Chest Fly
  INSERT INTO workout_day_exercises
    (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max)
  VALUES
    (v_day_sat, '00000000-0000-0000-0001-000000000007', 1, 2,  8, 12),
    (v_day_sat, '00000000-0000-0000-0001-000000000002', 2, 2, 10, 12),
    (v_day_sat, '00000000-0000-0000-0001-000000000001', 3, 2, 10, 12),
    (v_day_sat, '00000000-0000-0000-0001-000000000010', 4, 2, 12, 15),
    (v_day_sat, '00000000-0000-0000-0001-000000000015', 5, 2, 12, 15),
    (v_day_sat, '00000000-0000-0000-0001-000000000005', 6, 2, 10, 12);

  -- Sunday: Hack Squat, Overhead Triceps Extension, Bayesian Curl,
  --         Leg Extension, Tricep Pushdown, Preacher Curl
  INSERT INTO workout_day_exercises
    (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max)
  VALUES
    (v_day_sun, '00000000-0000-0000-0001-000000000013', 1, 2,  8, 12),
    (v_day_sun, '00000000-0000-0000-0001-000000000008', 2, 2, 10, 12),
    (v_day_sun, '00000000-0000-0000-0001-000000000014', 3, 2, 10, 12),
    (v_day_sun, '00000000-0000-0000-0001-000000000003', 4, 2, 12, 15),
    (v_day_sun, '00000000-0000-0000-0001-000000000011', 5, 2, 10, 12),
    (v_day_sun, '00000000-0000-0000-0001-000000000009', 6, 2, 10, 12);
END;
$$;
