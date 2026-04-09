import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PreviousExercisePerformance } from '../types/workout';

/**
 * Returns the most recent completed session's sets for a given workout day,
 * indexed by exercise_template_id. Used to populate the "previous" column
 * in set rows and to pre-fill weight/reps inputs.
 */
export function useLastWorkoutPerformance(workoutDayId: string | null) {
  return useQuery({
    queryKey: ['last_workout_performance', workoutDayId],
    enabled: workoutDayId != null,
    queryFn: async (): Promise<Record<string, PreviousExercisePerformance>> => {
      // Most recent completed session for this day
      const { data: session, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('workout_day_id', workoutDayId!)
        .not('ended_at', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessErr) throw new Error(sessErr.message);
      if (!session) return {};

      const { data: loggedExercises, error: leErr } = await supabase
        .from('logged_exercises')
        .select(`
          exercise_template_id,
          logged_sets (set_number, weight_kg, reps)
        `)
        .eq('session_id', session.id);

      if (leErr) throw new Error(leErr.message);

      const result: Record<string, PreviousExercisePerformance> = {};
      for (const le of loggedExercises ?? []) {
        result[le.exercise_template_id] = {
          exercise_template_id: le.exercise_template_id,
          sets: (le.logged_sets ?? [])
            .sort((a, b) => a.set_number - b.set_number)
            .map((s) => ({
              set_number: s.set_number,
              weight_kg: s.weight_kg,
              reps: s.reps,
            })),
        };
      }
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}
