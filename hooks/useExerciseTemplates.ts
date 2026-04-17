import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ExerciseTemplate } from '../types/workout';

export function useExerciseTemplates() {
  return useQuery({
    queryKey: ['exercise_templates'],
    queryFn: async (): Promise<ExerciseTemplate[]> => {
      const { data, error } = await supabase
        .from('exercise_templates')
        .select('*')
        .order('muscle_group', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ExerciseTemplate[];
    },
    staleTime: 30 * 60 * 1000,
  });
}
