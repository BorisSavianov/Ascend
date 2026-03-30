import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';

export function useStartFast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('fasting_logs' as never)
        .insert({
          started_at: new Date().toISOString(),
          target_hours: 16,
        } as never);

      if (error) throw new Error((error as { message: string }).message);
    },
    onSuccess: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void queryClient.invalidateQueries({ queryKey: ['active_fast'] });
    },
  });
}
