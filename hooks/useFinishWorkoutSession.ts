import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from '../store/useWorkoutStore';

/**
 * Sets ended_at on the workout session, marking it as complete.
 * Clears the active session from Zustand and invalidates relevant query caches.
 */
export function useFinishWorkoutSession() {
  const queryClient = useQueryClient();
  const { endSession } = useWorkoutStore();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw new Error(error.message);
    },

    onSuccess: () => {
      endSession();
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      void queryClient.invalidateQueries({
        queryKey: ['active_workout_session', dateStr],
      });
      // Invalidate all history queries so the history sheet reflects the new session
      void queryClient.invalidateQueries({ queryKey: ['workout_history'] });
      void queryClient.invalidateQueries({ queryKey: ['last_workout_performance'] });
    },
  });
}
