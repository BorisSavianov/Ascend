import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type VolumeDataPoint = {
  date: string;
  totalVolume: number;
  maxWeight: number;
};

/**
 * Returns the last 12 sessions that contain a given exercise,
 * with total volume (weight × reps) and max weight per session.
 */
export function useWorkoutVolume(exerciseTemplateId: string | null) {
  return useQuery({
    queryKey: ['workout_volume', exerciseTemplateId],
    enabled: exerciseTemplateId != null,
    queryFn: async (): Promise<VolumeDataPoint[]> => {
      // Find sessions that have this exercise, last 12
      const { data: loggedExercises, error: leErr } = await supabase
        .from('logged_exercises')
        .select(`
          session_id,
          logged_sets (weight_kg, reps, is_completed)
        `)
        .eq('exercise_template_id', exerciseTemplateId!)
        .order('session_id', { ascending: false })
        .limit(12);

      if (leErr) throw new Error(leErr.message);
      if (!loggedExercises || loggedExercises.length === 0) return [];

      const sessionIds = [...new Set(loggedExercises.map((le) => le.session_id))];

      const { data: sessions, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('id, date')
        .in('id', sessionIds)
        .eq('status', 'completed')
        .order('date', { ascending: true });

      if (sessErr) throw new Error(sessErr.message);

      return (sessions ?? []).map((session) => {
        const le = loggedExercises.find((e) => e.session_id === session.id);
        const completedSets = (le?.logged_sets ?? []).filter((s) => s.is_completed);

        const totalVolume = completedSets.reduce(
          (sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0),
          0,
        );
        const maxWeight = completedSets.reduce(
          (max, s) => Math.max(max, s.weight_kg ?? 0),
          0,
        );

        return { date: session.date, totalVolume, maxWeight };
      });
    },
    staleTime: 60_000,
  });
}
