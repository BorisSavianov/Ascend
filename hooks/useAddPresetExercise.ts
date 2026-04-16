import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type AddPresetExerciseVariables = {
  presetId: string;
  exerciseTemplateId: string;
  sortOrder: number;
  defaultSets?: number;
  defaultRepsMin?: number;
  defaultRepsMax?: number;
};

export function useAddPresetExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      presetId,
      exerciseTemplateId,
      sortOrder,
      defaultSets = 2,
      defaultRepsMin = 10,
      defaultRepsMax = 12,
    }: AddPresetExerciseVariables): Promise<void> => {
      const { error } = await supabase
        .from('workout_preset_exercises')
        .insert({
          preset_id: presetId,
          exercise_template_id: exerciseTemplateId,
          sort_order: sortOrder,
          default_sets: defaultSets,
          default_reps_min: defaultRepsMin,
          default_reps_max: defaultRepsMax,
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { presetId }) => {
      void queryClient.invalidateQueries({ queryKey: ['preset_exercises', presetId] });
      void queryClient.invalidateQueries({ queryKey: ['workout_presets'] });
    },
  });
}
