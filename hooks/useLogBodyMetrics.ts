import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';

type LogBodyMetricsInput = {
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  notes?: string | null;
};

export function useLogBodyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogBodyMetricsInput) => {
      const { error } = await supabase
        .from('body_metrics' as never)
        .insert({
          ...input,
          recorded_at: new Date().toISOString(),
        } as never);

      if (error) throw new Error((error as { message: string }).message);
    },
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: ['body_metrics'] });
    },
    onError: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
}
