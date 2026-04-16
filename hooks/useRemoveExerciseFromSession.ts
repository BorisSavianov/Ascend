import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

type RemoveExerciseVariables = {
  loggedExerciseId: string;
  date: Date;
};

export function useRemoveExerciseFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ loggedExerciseId }: RemoveExerciseVariables): Promise<void> => {
      const { error } = await supabase
        .from('logged_exercises')
        .delete()
        .eq('id', loggedExerciseId);

      if (error) throw new Error(error.message);
    },

    onSuccess: (_, { date }) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      void queryClient.invalidateQueries({ queryKey: ['active_workout_session', dateStr] });
    },
  });
}
