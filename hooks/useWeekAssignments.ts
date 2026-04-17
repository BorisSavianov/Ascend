import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { DayAssignment } from '../types/workout';

export type WeekAssignment = DayAssignment & {
  preset: { id: string; name: string } | null;
};

export function useWeekAssignments() {
  return useQuery({
    queryKey: ['week_assignments'],
    queryFn: async (): Promise<WeekAssignment[]> => {
      const { data, error } = await supabase
        .from('day_assignments')
        .select(`
          user_id,
          day_of_week,
          preset_id,
          preset:workout_presets (id, name)
        `)
        .order('day_of_week', { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as WeekAssignment[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
