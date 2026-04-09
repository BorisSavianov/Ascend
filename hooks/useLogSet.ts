import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from '../store/useWorkoutStore';
import type { WorkoutSessionWithExercises, LoggedSet } from '../types/workout';

type LogSetVariables = {
  setId: string;
  loggedExerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  isCompleted: boolean;
};

/**
 * Updates a single logged_set row with optimistic UI.
 *
 * Uses a single denormalized cache key ['active_workout_session', dateStr]
 * so one setQueryData call covers everything the workout screen renders.
 * Rolls back on error. Fires haptic feedback on completion.
 */
export function useLogSet() {
  const queryClient = useQueryClient();
  const { markSetSaving, markSetCompleted } = useWorkoutStore();

  return useMutation({
    mutationFn: async (variables: LogSetVariables) => {
      const { error } = await supabase
        .from('logged_sets')
        .update({
          weight_kg: variables.weightKg,
          reps: variables.reps,
          rpe: variables.rpe ?? null,
          is_completed: variables.isCompleted,
          completed_at: variables.isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', variables.setId);

      if (error) throw new Error(error.message);
    },

    onMutate: async (variables) => {
      const setIndex = variables.setNumber - 1;
      markSetSaving(variables.loggedExerciseId, setIndex, true);

      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const qKey = ['active_workout_session', dateStr];

      await queryClient.cancelQueries({ queryKey: qKey });
      const previousData = queryClient.getQueryData<WorkoutSessionWithExercises>(qKey);

      // Optimistically update the matching set in the cache
      queryClient.setQueryData<WorkoutSessionWithExercises>(qKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          logged_exercises: old.logged_exercises.map((le) => {
            if (le.id !== variables.loggedExerciseId) return le;
            return {
              ...le,
              logged_sets: le.logged_sets.map((s: LoggedSet) =>
                s.id === variables.setId
                  ? {
                      ...s,
                      weight_kg: variables.weightKg,
                      reps: variables.reps,
                      rpe: variables.rpe,
                      is_completed: variables.isCompleted,
                      completed_at: variables.isCompleted
                        ? new Date().toISOString()
                        : null,
                    }
                  : s,
              ),
            };
          }),
        };
      });

      return { previousData, dateStr };
    },

    onError: (_err, variables, context) => {
      const setIndex = variables.setNumber - 1;
      markSetSaving(variables.loggedExerciseId, setIndex, false);
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(
          ['active_workout_session', context.dateStr],
          context.previousData,
        );
      }
    },

    onSuccess: (_, variables) => {
      const setIndex = variables.setNumber - 1;
      markSetSaving(variables.loggedExerciseId, setIndex, false);
      markSetCompleted(variables.loggedExerciseId, setIndex, variables.isCompleted);
      if (variables.isCompleted) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },

    onSettled: (_, __, ___, context) => {
      if (context?.dateStr) {
        void queryClient.invalidateQueries({
          queryKey: ['active_workout_session', context.dateStr],
        });
      }
    },
  });
}
