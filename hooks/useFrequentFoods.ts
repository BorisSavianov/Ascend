import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { FoodRow } from '../types/database';

export function useFrequentFoods(): {
  data: FoodRow[];
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['frequent_foods'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: rows, error: queryError } = await supabase
        .from('foods')
        .select('*')
        .eq('user_id', user?.id ?? '')
        .order('use_count', { ascending: false })
        .limit(10);

      if (queryError) throw new Error(queryError.message);
      return rows ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
