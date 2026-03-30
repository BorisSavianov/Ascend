import { useQuery } from '@tanstack/react-query';
import { format, endOfDay, startOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { MealRow, MealItemRow } from '../types/database';

export type MealWithItems = MealRow & {
  meal_items: MealItemRow[];
};

export function useTodayMeals(date: Date = new Date()): {
  data: MealWithItems[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const dateStr = format(date, 'yyyy-MM-dd');
  const start = startOfDay(date).toISOString();
  const end = endOfDay(date).toISOString();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['today_meals', dateStr],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('meals')
        .select('*, meal_items(*)')
        .gte('logged_at', start)
        .lte('logged_at', end)
        .order('logged_at', { ascending: true });

      if (queryError) throw new Error(queryError.message);
      return (rows ?? []) as MealWithItems[];
    },
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    data: data ?? [],
    isLoading,
    isFetching,
    error: error as Error | null,
    refetch,
  };
}
