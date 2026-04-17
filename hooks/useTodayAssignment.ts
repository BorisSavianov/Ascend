import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WorkoutPresetWithExercises } from '../types/workout';

export type TodayAssignment = {
  dayOfWeek: number;
  preset: WorkoutPresetWithExercises | null;
};

export function useTodayAssignment(date: Date = new Date()) {
  const dayOfWeek = date.getDay();

  return useQuery({
    queryKey: ['day_assignment', dayOfWeek],
    queryFn: async (): Promise<TodayAssignment> => {
      const { data, error } = await supabase
        .from('day_assignments')
        .select(`
          day_of_week,
          preset_id,
          preset:workout_presets (
            *,
            exercises:workout_preset_exercises (
              *,
              exercise_template:exercise_templates (*)
            )
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (error) throw new Error(error.message);

      if (!data || !data.preset) {
        return { dayOfWeek, preset: null };
      }

      // Sort exercises by sort_order
      const preset: WorkoutPresetWithExercises = {
        ...data.preset,
        exercises: [...(data.preset.exercises ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      };

      return { dayOfWeek, preset };
    },
    staleTime: 5 * 60 * 1000,
  });
}
