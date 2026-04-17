import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CreatePresetInputSchema } from '../schemas/validation';

export function useUpdatePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<void> => {
      CreatePresetInputSchema.parse({ name });

      const { error } = await supabase
        .from('workout_presets')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['workout_presets'] });
      void queryClient.invalidateQueries({ queryKey: ['preset_exercises', id] });
    },
  });
}
