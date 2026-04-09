import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { LoggedExercise, WorkoutSessionWithExercises } from '../types/workout';

/**
 * Returns the last 10 completed sessions for a given workout_day_id,
 * each with their logged exercises and sets.
 */
export function useWorkoutHistory(workoutDayId: string | null) {
  return useQuery({
    queryKey: ['workout_history', workoutDayId],
    enabled: workoutDayId != null,
    queryFn: async (): Promise<WorkoutSessionWithExercises[]> => {
      const { data: sessions, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('workout_day_id', workoutDayId!)
        .not('ended_at', 'is', null)
        .order('date', { ascending: false })
        .limit(10);

      if (sessErr) throw new Error(sessErr.message);
      if (!sessions || sessions.length === 0) return [];

      // Batch-fetch all exercises for these sessions in one query
      const sessionIds = sessions.map((s) => s.id);

      const { data: loggedExercises, error: leErr } = await supabase
        .from('logged_exercises')
        .select(`
          *,
          exercise_template:exercise_templates (*),
          logged_sets (*)
        `)
        .in('session_id', sessionIds)
        .order('sort_order', { ascending: true });

      if (leErr) throw new Error(leErr.message);

      return sessions.map((session) => ({
        ...session,
        logged_exercises: (loggedExercises ?? [])
          .filter((le) => le.session_id === session.id)
          .map(
            (le): LoggedExercise => ({
              ...le,
              exercise_template: le.exercise_template,
              logged_sets: [...(le.logged_sets ?? [])].sort(
                (a, b) => a.set_number - b.set_number,
              ),
            }),
          ),
      }));
    },
    staleTime: 60_000,
  });
}
