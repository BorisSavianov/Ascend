import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export function useDeleteMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mealId, loggedAt }: { mealId: string; loggedAt: string }) => {
      const { error } = await supabase.from('meals').delete().eq('id', mealId);
      if (error) throw new Error(error.message);
      return { dateStr: format(new Date(loggedAt), 'yyyy-MM-dd') };
    },
    onSuccess: ({ dateStr }) => {
      void queryClient.invalidateQueries({ queryKey: ['today_meals', dateStr] });
      void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
      void queryClient.invalidateQueries({ queryKey: ['weekly_trends'] });
    },
    onError: (err) => {
      logger.warn('Delete meal error:', err.message);
    },
  });
}
