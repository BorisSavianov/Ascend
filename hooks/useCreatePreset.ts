import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CreatePresetInputSchema } from '../schemas/validation';
import type { WorkoutPreset } from '../types/workout';

export function useCreatePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<WorkoutPreset> => {
      CreatePresetInputSchema.parse({ name });

      const { data, error } = await supabase
        .from('workout_presets')
        .insert({ name })
        .select('*')
        .single();

      if (error || !data) throw new Error(error?.message ?? 'Failed to create preset');
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout_presets'] });
    },
  });
}
