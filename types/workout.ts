// Workout module types

export type ExerciseTemplate = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  image_key: string | null;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  created_at: string;
};

export type WorkoutPreset = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutPresetExercise = {
  id: string;
  preset_id: string;
  exercise_template_id: string;
  sort_order: number;
  default_sets: number;
  default_reps_min: number;
  default_reps_max: number;
  default_weight_kg: number | null;
  exercise_template: ExerciseTemplate;
};

export type WorkoutPresetWithExercises = WorkoutPreset & {
  exercises: WorkoutPresetExercise[];
};

export type DayAssignment = {
  user_id: string;
  day_of_week: number; // 0=Sun, 1=Mon, ..., 6=Sat
  preset_id: string | null;
  preset?: WorkoutPreset | null;
};

export type SessionSnapshot = {
  preset_name: string;
  exercises: Array<{
    exercise_template_id: string;
    name: string;
    default_sets: number;
    default_reps_min: number;
    default_reps_max: number;
    default_weight_kg: number | null;
  }>;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  preset_id: string | null;
  date: string; // 'YYYY-MM-DD'
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'paused' | 'completed';
  session_snapshot: SessionSnapshot | null;
  notes: string | null;
  created_at: string;
};

export type LoggedExercise = {
  id: string;
  session_id: string;
  exercise_template_id: string;
  sort_order: number;
  exercise_template: ExerciseTemplate;
  logged_sets: LoggedSet[];
};

export type LoggedSet = {
  id: string;
  logged_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
};

// Composed types returned by hooks

export type WorkoutSessionWithExercises = WorkoutSession & {
  logged_exercises: LoggedExercise[];
};

export type PreviousSetPerformance = {
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
};

export type PreviousExercisePerformance = {
  exercise_template_id: string;
  sets: PreviousSetPerformance[];
};
