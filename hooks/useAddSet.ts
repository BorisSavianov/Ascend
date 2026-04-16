import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from '../store/useWorkoutStore';

type AddSetVariables = {
  loggedExerciseId: string;
  currentSetCount: number;
  date: Date;
};

export function useAddSet() {
  const queryClient = useQueryClient();
  const { addSetInput } = useWorkoutStore();

  return useMutation({
    mutationFn: async ({ loggedExerciseId, currentSetCount }: AddSetVariables): Promise<void> => {
      const { error } = await supabase.from('logged_sets').insert({
        logged_exercise_id: loggedExerciseId,
        set_number: currentSetCount + 1,
        is_completed: false,
      });

      if (error) throw new Error(error.message);
    },

    onSuccess: (_, { loggedExerciseId, date }) => {
      addSetInput(loggedExerciseId, true);
      const dateStr = format(date, 'yyyy-MM-dd');
      void queryClient.invalidateQueries({ queryKey: ['active_workout_session', dateStr] });
    },
  });
}
