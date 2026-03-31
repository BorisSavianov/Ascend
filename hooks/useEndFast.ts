import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { cancelFastNearEndReminder } from '../lib/notifications';

export function useEndFast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fastId: string) => {
      const { error } = await supabase
        .from('fasting_logs' as never)
        .update({ ended_at: new Date().toISOString() } as never)
        .eq('id' as never, fastId);

      if (error) throw new Error((error as { message: string }).message);
    },
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: ['active_fast'] });
      void queryClient.invalidateQueries({ queryKey: ['fasting_history'] });
      void cancelFastNearEndReminder();
    },
  });
}
