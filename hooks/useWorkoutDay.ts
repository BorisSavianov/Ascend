import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WorkoutDayWithExercises } from '../types/workout';

/**
 * Fetches the workout day template for a given date from the user's active program.
 * Returns the day with its exercises (including exercise_template data) sorted by sort_order.
 * Returns null if no program exists or if the day isn't configured (shouldn't happen after seeding).
 */
export function useWorkoutDay(date: Date = new Date()) {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat — matches DB day_of_week

  return useQuery({
    queryKey: ['workout_day', dayOfWeek],
    queryFn: async (): Promise<WorkoutDayWithExercises | null> => {
      // 1. Get the user's active program
      const { data: program, error: progErr } = await supabase
        .from('workout_programs')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (progErr) throw new Error(progErr.message);
      if (!program) return null;

      // 2. Get the workout_day for today's day_of_week
      const { data: day, error: dayErr } = await supabase
        .from('workout_days')
        .select('*')
        .eq('program_id', program.id)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (dayErr) throw new Error(dayErr.message);
      if (!day) return null;

      // 3. Get exercises for this day with their template data
      const { data: dayExercises, error: exErr } = await supabase
        .from('workout_day_exercises')
        .select(`
          *,
          exercise_template:exercise_templates (*)
        `)
        .eq('workout_day_id', day.id)
        .order('sort_order', { ascending: true });

      if (exErr) throw new Error(exErr.message);

      return {
        ...day,
        exercises: (dayExercises ?? []) as WorkoutDayWithExercises['exercises'],
      };
    },
    staleTime: 5 * 60 * 1000, // template changes rarely
  });
}
