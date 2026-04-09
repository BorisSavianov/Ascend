// Workout module types
// These supplement types/database.ts until Supabase types are regenerated
// after migrations 009 and 010 are applied.

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

export type WorkoutProgram = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type WorkoutDay = {
  id: string;
  program_id: string;
  day_of_week: number; // 0=Sun, 1=Mon, ..., 6=Sat (JS getDay())
  name: string;
  is_rest_day: boolean;
};

export type WorkoutDayExercise = {
  id: string;
  workout_day_id: string;
  exercise_template_id: string;
  sort_order: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  exercise_template: ExerciseTemplate;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  workout_day_id: string;
  date: string; // 'YYYY-MM-DD'
  started_at: string;
  ended_at: string | null;
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

export type WorkoutDayWithExercises = WorkoutDay & {
  exercises: WorkoutDayExercise[];
};

export type WorkoutSessionWithExercises = WorkoutSession & {
  logged_exercises: LoggedExercise[];
  workout_day?: WorkoutDay;
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
