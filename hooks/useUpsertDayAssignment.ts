import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { UpsertDayAssignmentSchema } from '../schemas/validation';

export function useUpsertDayAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dayOfWeek,
      presetId,
    }: {
      dayOfWeek: number;
      presetId: string | null;
    }): Promise<void> => {
      UpsertDayAssignmentSchema.parse({ dayOfWeek, presetId });

      const { error } = await supabase
        .from('day_assignments')
        .upsert(
          { day_of_week: dayOfWeek, preset_id: presetId },
          { onConflict: 'user_id,day_of_week' },
        );

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { dayOfWeek }) => {
      void queryClient.invalidateQueries({ queryKey: ['week_assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['day_assignment', dayOfWeek] });
    },
  });
}
