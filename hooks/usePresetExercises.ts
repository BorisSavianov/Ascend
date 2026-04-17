import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WorkoutPresetExercise } from '../types/workout';

export function usePresetExercises(presetId: string | null) {
  return useQuery({
    queryKey: ['preset_exercises', presetId],
    enabled: presetId != null,
    queryFn: async (): Promise<WorkoutPresetExercise[]> => {
      const { data, error } = await supabase
        .from('workout_preset_exercises')
        .select(`
          *,
          exercise_template:exercise_templates (*)
        `)
        .eq('preset_id', presetId!)
        .order('sort_order', { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as WorkoutPresetExercise[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
