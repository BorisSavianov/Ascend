import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { LoggedExercise, WorkoutSession, WorkoutSessionWithExercises } from '../types/workout';

/**
 * Fetches today's in-progress workout session (started but not yet ended).
 * Also fetches all logged_exercises with their exercise_template and logged_sets.
 * staleTime: 0 — always fresh while a session is active.
 */
export function useActiveWorkoutSession(date: Date = new Date()) {
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['active_workout_session', dateStr],
    queryFn: async (): Promise<WorkoutSessionWithExercises | null> => {
      const { data: session, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('date', dateStr)
        .is('ended_at', null)
        .neq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessErr) throw new Error(sessErr.message);
      if (!session) return null;

      // Fetch logged exercises with exercise template + sets in one query
      const { data: loggedExercises, error: leErr } = await supabase
        .from('logged_exercises')
        .select(`
          *,
          exercise_template:exercise_templates (*),
          logged_sets (*)
        `)
        .eq('session_id', session.id)
        .order('sort_order', { ascending: true });

      if (leErr) throw new Error(leErr.message);

      // Sort sets within each exercise by set_number
      const exercises: LoggedExercise[] = (loggedExercises ?? []).map((le) => ({
        ...le,
        exercise_template: le.exercise_template,
        logged_sets: [...(le.logged_sets ?? [])].sort(
          (a, b) => a.set_number - b.set_number,
        ),
      }));

      return {
        ...session,
        status: session.status as WorkoutSession['status'],
        session_snapshot: session.session_snapshot as WorkoutSession['session_snapshot'],
        logged_exercises: exercises,
      };
    },
    staleTime: 0, // always re-fetch — active session data changes frequently
  });
}
