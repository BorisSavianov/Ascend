import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

type LogExerciseVariables = {
  name: string;
  category?: string;
  durationMin: number;
  caloriesBurned: number;
  loggedAt?: Date;
};

export function useLogExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: LogExerciseVariables) => {
      const loggedAt = variables.loggedAt ?? new Date();

      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: variables.name,
          category: variables.category ?? null,
          duration_min: variables.durationMin,
          calories_burned: variables.caloriesBurned,
          logged_at: loggedAt.toISOString(),
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to log exercise');
      }

      return data.id;
    },

    onSettled: (_data, _err, variables) => {
      const dateStr = format(variables.loggedAt ?? new Date(), 'yyyy-MM-dd');
      void queryClient.invalidateQueries({ queryKey: ['exercises', dateStr] });
      void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
    },
  });
}
