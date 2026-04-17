import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

type AddExerciseVariables = {
  sessionId: string;
  exerciseTemplateId: string;
  sortOrder: number;
  defaultSets: number;
  date: Date;
};

type AddExerciseResult = {
  loggedExerciseId: string;
};

export function useAddExerciseToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      exerciseTemplateId,
      sortOrder,
      defaultSets,
    }: AddExerciseVariables): Promise<AddExerciseResult> => {
      const { data: le, error: leErr } = await supabase
        .from('logged_exercises')
        .insert({
          session_id: sessionId,
          exercise_template_id: exerciseTemplateId,
          sort_order: sortOrder,
        })
        .select('id')
        .single();

      if (leErr || !le) throw new Error(leErr?.message ?? 'Failed to add exercise');

      // Pre-create empty set rows
      const sets = Array.from({ length: defaultSets }, (_, i) => ({
        logged_exercise_id: le.id,
        set_number: i + 1,
        is_completed: false,
      }));

      const { error: setsErr } = await supabase.from('logged_sets').insert(sets);
      if (setsErr) throw new Error(setsErr.message);

      return { loggedExerciseId: le.id };
    },

    onSuccess: (_, { date }) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      void queryClient.invalidateQueries({ queryKey: ['active_workout_session', dateStr] });
    },
  });
}
