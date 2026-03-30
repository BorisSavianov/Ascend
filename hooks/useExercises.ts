import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

export function useExercises(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['exercises', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .gte('logged_at', `${dateStr}T00:00:00`)
        .lte('logged_at', `${dateStr}T23:59:59`)
        .order('logged_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
