-- Update the seed function to match the user's specific program names and rep ranges
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
  VALUES (p_user_id, 'Strength Program', TRUE)
  RETURNING id INTO v_program_id;

  -- Days labeling matching user request
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 1, 'Monday — Rest / Optional Cardio',  TRUE)  RETURNING id INTO v_day_mon;
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 2, 'Tuesday — Rest / Optional Cardio', TRUE)  RETURNING id INTO v_day_tue;
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 3, 'Wednesday',                        FALSE) RETURNING id INTO v_day_wed;
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 4, 'Thursday',                         FALSE) RETURNING id INTO v_day_thu;
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 5, 'Friday — Rest / Optional Cardio',   TRUE)  RETURNING id INTO v_day_fri;
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 6, 'Saturday',                         FALSE) RETURNING id INTO v_day_sat;
  INSERT INTO workout_days (program_id, day_of_week, name, is_rest_day)
  VALUES (v_program_id, 0, 'Sunday',                           FALSE) RETURNING id INTO v_day_sun;

  -- Wednesday Exercises
  INSERT INTO workout_day_exercises (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max) VALUES
    (v_day_wed, '00000000-0000-0000-0001-000000000001', 1, 2, 10, 12), -- Lat Pulldown
    (v_day_wed, '00000000-0000-0000-0001-000000000002', 2, 2, 8, 12),  -- Incline Chest Press
    (v_day_wed, '00000000-0000-0000-0001-000000000003', 3, 2, 12, 15), -- Leg Extension
    (v_day_wed, '00000000-0000-0000-0001-000000000004', 4, 2, 10, 12), -- Seated Row
    (v_day_wed, '00000000-0000-0000-0001-000000000005', 5, 2, 10, 12), -- Seated Chest Fly
    (v_day_wed, '00000000-0000-0000-0001-000000000006', 6, 2, 12, 15); -- Lying Leg Curl

  -- Thursday Exercises
  INSERT INTO workout_day_exercises (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max) VALUES
    (v_day_thu, '00000000-0000-0000-0001-000000000007', 1, 2, 8, 12),  -- Shoulder Press
    (v_day_thu, '00000000-0000-0000-0001-000000000008', 2, 2, 10, 12), -- Overhead Triceps Extension
    (v_day_thu, '00000000-0000-0000-0001-000000000009', 3, 2, 10, 12), -- Preacher Curl
    (v_day_thu, '00000000-0000-0000-0001-000000000010', 4, 2, 10, 12), -- Lateral Raise
    (v_day_thu, '00000000-0000-0000-0001-000000000011', 5, 2, 10, 12), -- Tricep Pushdown
    (v_day_thu, '00000000-0000-0000-0001-000000000012', 6, 2, 10, 12); -- Hammer Curl

  -- Saturday Exercises
  INSERT INTO workout_day_exercises (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max) VALUES
    (v_day_sat, '00000000-0000-0000-0001-000000000007', 1, 2, 8, 12),  -- Shoulder Press
    (v_day_sat, '00000000-0000-0000-0001-000000000002', 2, 2, 10, 12), -- Incline Chest Press
    (v_day_sat, '00000000-0000-0000-0001-000000000001', 3, 2, 10, 12), -- Lat Pulldown
    (v_day_sat, '00000000-0000-0000-0001-000000000010', 4, 2, 12, 15), -- Lateral Raise
    (v_day_sat, '00000000-0000-0000-0001-000000000015', 5, 2, 12, 15), -- Seated Reverse Fly
    (v_day_sat, '00000000-0000-0000-0001-000000000005', 6, 2, 10, 12); -- Seated Chest Fly

  -- Sunday Exercises
  INSERT INTO workout_day_exercises (workout_day_id, exercise_template_id, sort_order, target_sets, target_reps_min, target_reps_max) VALUES
    (v_day_sun, '00000000-0000-0000-0001-000000000013', 1, 2, 8, 12),  -- Hack Squat
    (v_day_sun, '00000000-0000-0000-0001-000000000008', 2, 2, 10, 12), -- Overhead Triceps Extension
    (v_day_sun, '00000000-0000-0000-0001-000000000014', 3, 2, 10, 12), -- Bayesian Curl
    (v_day_sun, '00000000-0000-0000-0001-000000000003', 4, 2, 12, 15), -- Leg Extension
    (v_day_sun, '00000000-0000-0000-0001-000000000011', 5, 2, 10, 12), -- Tricep Pushdown
    (v_day_sun, '00000000-0000-0000-0001-000000000009', 6, 2, 10, 10); -- Preacher Curl (Fixed to 10-10)
END;
$$;
