import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WorkoutPreset } from '../types/workout';

export function useWorkoutPresets() {
  return useQuery({
    queryKey: ['workout_presets'],
    queryFn: async (): Promise<WorkoutPreset[]> => {
      const { data, error } = await supabase
        .from('workout_presets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
