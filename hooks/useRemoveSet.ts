import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from '../store/useWorkoutStore';

type RemoveSetVariables = {
  setId: string;
  loggedExerciseId: string;
  setNumber: number;
  setIndex: number;
  date: Date;
};

export function useRemoveSet() {
  const queryClient = useQueryClient();
  const { removeSetInput } = useWorkoutStore();

  return useMutation({
    mutationFn: async ({ setId, loggedExerciseId, setNumber }: RemoveSetVariables): Promise<void> => {
      const { error: deleteErr } = await supabase
        .from('logged_sets')
        .delete()
        .eq('id', setId);

      if (deleteErr) throw new Error(deleteErr.message);

      // Renumber remaining sets after the deleted one
      const { data: remaining, error: fetchErr } = await supabase
        .from('logged_sets')
        .select('id, set_number')
        .eq('logged_exercise_id', loggedExerciseId)
        .gt('set_number', setNumber)
        .order('set_number', { ascending: true });

      if (fetchErr) throw new Error(fetchErr.message);

      if (remaining && remaining.length > 0) {
        await Promise.all(
          remaining.map((s) =>
            supabase
              .from('logged_sets')
              .update({ set_number: s.set_number - 1 })
              .eq('id', s.id),
          ),
        );
      }
    },

    onSuccess: (_, { loggedExerciseId, setIndex, date }) => {
      removeSetInput(loggedExerciseId, setIndex);
      const dateStr = format(date, 'yyyy-MM-dd');
      void queryClient.invalidateQueries({ queryKey: ['active_workout_session', dateStr] });
    },
  });
}
