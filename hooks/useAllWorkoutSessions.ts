import { useQuery } from '@tanstack/react-query';
import { subDays, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { WorkoutSession, WorkoutSessionWithExercises } from '../types/workout';

/**
 * Fetches all completed workout sessions for the past 90 days.
 * Includes logged_exercises + logged_sets for drill-down views.
 */
export function useAllWorkoutSessions() {
  return useQuery({
    queryKey: ['all_workout_sessions'],
    queryFn: async (): Promise<WorkoutSessionWithExercises[]> => {
      const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');

      const { data: sessions, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('status', 'completed')
        .gte('date', since)
        .order('date', { ascending: false })
        .limit(200);

      if (sessErr) throw new Error(sessErr.message);
      if (!sessions || sessions.length === 0) return [];

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
        status: session.status as WorkoutSession['status'],
        session_snapshot: session.session_snapshot as WorkoutSession['session_snapshot'],
        logged_exercises: (loggedExercises ?? [])
          .filter((le) => le.session_id === session.id)
          .map((le) => ({
            ...le,
            exercise_template: le.exercise_template,
            logged_sets: [...(le.logged_sets ?? [])].sort(
              (a, b) => a.set_number - b.set_number,
            ),
          })),
      }));
    },
    staleTime: 60_000,
  });
}
