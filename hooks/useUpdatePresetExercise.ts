import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type UpdatePresetExerciseVars = {
  id: string;
  presetId: string;
  defaultSets: number;
  defaultRepsMin: number;
  defaultRepsMax: number;
  defaultWeightKg?: number | null;
};

export function useUpdatePresetExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, defaultSets, defaultRepsMin, defaultRepsMax, defaultWeightKg }: UpdatePresetExerciseVars) => {
      const { error } = await supabase
        .from('workout_preset_exercises')
        .update({
          default_sets: defaultSets,
          default_reps_min: defaultRepsMin,
          default_reps_max: defaultRepsMax,
          default_weight_kg: defaultWeightKg ?? null,
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { presetId }) => {
      void queryClient.invalidateQueries({ queryKey: ['preset_exercises', presetId] });
    },
  });
}
