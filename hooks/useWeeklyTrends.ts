import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { DailySummaryRow } from '../types/database';

export function useWeeklyTrends(): {
  data: DailySummaryRow[];
  isLoading: boolean;
  error: Error | null;
} {
  const today = new Date();
  const from = format(subDays(today, 6), 'yyyy-MM-dd');
  const to = format(today, 'yyyy-MM-dd');

  const { data, isLoading, error } = useQuery({
    queryKey: ['weekly_trends', from, to],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('daily_summaries')
        .select('*')
        .gte('log_date', from)
        .lte('log_date', to)
        .order('log_date', { ascending: true });

      if (queryError) throw new Error(queryError.message);
      return rows ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
