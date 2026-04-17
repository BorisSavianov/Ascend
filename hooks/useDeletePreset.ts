import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useDeletePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (presetId: string): Promise<void> => {
      const { error } = await supabase
        .from('workout_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout_presets'] });
      void queryClient.invalidateQueries({ queryKey: ['week_assignments'] });
      // Invalidate all day_assignment queries (any dayOfWeek could have had this preset)
      void queryClient.invalidateQueries({ queryKey: ['day_assignment'] });
    },
  });
}
