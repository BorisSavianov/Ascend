import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { scheduleFastNearEndReminder } from '../lib/notifications';

export function useStartFast() {
  const queryClient = useQueryClient();
  const fastingTargetHours = useAppStore((s) => s.fastingTargetHours);
  const fastingNearEndReminderEnabled = useAppStore((s) => s.fastingNearEndReminderEnabled);

  return useMutation({
    mutationFn: async () => {
      const startedAt = new Date().toISOString();
      const { error } = await supabase
        .from('fasting_logs')
        .insert({
          started_at: startedAt,
          target_hours: fastingTargetHours,
        });

      if (error) throw new Error(error.message);
      return { startedAt, targetHours: fastingTargetHours };
    },
    onSuccess: ({ startedAt, targetHours }) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void queryClient.invalidateQueries({ queryKey: ['active_fast'] });
      void scheduleFastNearEndReminder(
        startedAt,
        targetHours,
        fastingNearEndReminderEnabled,
      );
    },
  });
}
