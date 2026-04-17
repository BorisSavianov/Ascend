import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useRemovePresetExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; presetId: string }): Promise<void> => {
      const { error } = await supabase
        .from('workout_preset_exercises')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { presetId }) => {
      void queryClient.invalidateQueries({ queryKey: ['preset_exercises', presetId] });
    },
  });
}
