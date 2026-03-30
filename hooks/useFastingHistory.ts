import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { FastingLog } from '../types/database';

export function useFastingHistory(): {
  data: FastingLog[];
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fasting_history'],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('fasting_logs' as never)
        .select('*')
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(7);

      if (queryError) throw new Error((queryError as { message: string }).message);
      return (rows ?? []) as FastingLog[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
