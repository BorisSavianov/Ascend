import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { BodyMetricRow } from '../types/database';

export function useBodyMetrics(): {
  data: BodyMetricRow[];
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['body_metrics'],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('body_metrics' as never)
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(30);

      if (queryError) throw new Error((queryError as { message: string }).message);
      return (rows ?? []) as BodyMetricRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
