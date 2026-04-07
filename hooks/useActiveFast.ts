import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { FastingLog } from '../types/database';

export function useActiveFast(): {
  data: FastingLog | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['active_fast'],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('fasting_logs')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);

      if (queryError) throw new Error(queryError.message);

      const list = (rows ?? []) as FastingLog[];
      return list.length > 0 ? list[0] : null;
    },
    staleTime: 0, // always fresh — fast state is critical
  });

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}
