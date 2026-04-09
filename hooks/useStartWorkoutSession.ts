import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { StartSessionInputSchema } from '../schemas/validation';
import type { WorkoutDayWithExercises } from '../types/workout';

type StartSessionVariables = {
  workoutDay: WorkoutDayWithExercises;
  date: Date;
};

type StartSessionResult = {
  sessionId: string;
  loggedExercises: Array<{ id: string; exercise_template_id: string; sort_order: number }>;
};

/**
 * Creates a workout session and pre-creates all logged_exercises + empty logged_sets.
 *
 * Pre-creating sets at session start means the workout screen only ever UPDATEs
 * existing rows — no INSERT race conditions during logging, and set IDs are known
 * before the user touches anything (simplifies optimistic updates).
 */
export function useStartWorkoutSession() {
  const queryClient = useQueryClient();
  const { startSession } = useWorkoutStore();

  return useMutation({
    mutationFn: async ({
      workoutDay,
      date,
    }: StartSessionVariables): Promise<StartSessionResult> => {
      const dateStr = format(date, 'yyyy-MM-dd');
      StartSessionInputSchema.parse({ workoutDayId: workoutDay.id, date: dateStr });

      // 1. Create the session row
      const { data: session, error: sessErr } = await supabase
        .from('workout_sessions')
        .insert({
          workout_day_id: workoutDay.id,
          date: dateStr,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (sessErr || !session) {
        throw new Error(sessErr?.message ?? 'Failed to create session');
      }

      // 2. Pre-create logged_exercise rows (one per day exercise)
      const exerciseRows = workoutDay.exercises.map((ex) => ({
        session_id: session.id,
        exercise_template_id: ex.exercise_template_id,
        sort_order: ex.sort_order,
      }));

      const { data: loggedExs, error: leErr } = await supabase
        .from('logged_exercises')
        .insert(exerciseRows)
        .select('id, exercise_template_id, sort_order');

      if (leErr || !loggedExs) {
        throw new Error(leErr?.message ?? 'Failed to create logged exercises');
      }

      // 3. Pre-create empty logged_set rows for each exercise
      const setRows = loggedExs.flatMap((le) => {
        const template = workoutDay.exercises.find(
          (ex) => ex.exercise_template_id === le.exercise_template_id,
        );
        const targetSets = template?.target_sets ?? 2;
        return Array.from({ length: targetSets }, (_, i) => ({
          logged_exercise_id: le.id,
          set_number: i + 1,
          is_completed: false,
        }));
      });

      const { error: setsErr } = await supabase.from('logged_sets').insert(setRows);
      if (setsErr) throw new Error(setsErr.message);

      return { sessionId: session.id, loggedExercises: loggedExs };
    },

    onSuccess: ({ sessionId }, { workoutDay }) => {
      startSession(sessionId, workoutDay.id);
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      void queryClient.invalidateQueries({
        queryKey: ['active_workout_session', dateStr],
      });
      void queryClient.invalidateQueries({
        queryKey: ['workout_history', workoutDay.id],
      });
    },
  });
}
