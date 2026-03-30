import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { DailySummaryRow } from '../types/database';

export function useDailySummary(date: Date = new Date()): {
  data: DailySummaryRow | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
} {
  const dateStr = format(date, 'yyyy-MM-dd');

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['daily_summaries', dateStr],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('log_date', dateStr)
        .maybeSingle();

      if (queryError) throw new Error(queryError.message);
      return rows ?? null;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    data: data ?? null,
    isLoading,
    isFetching,
    error: error as Error | null,
  };
}
