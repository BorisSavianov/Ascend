import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAppStore, type AppStore, type MealItemDraft } from '../store/useAppStore';
import type { MealWithItems } from './useTodayMeals';
import type { DailySummaryRow } from '../types/database';

const LogMealVariablesSchema = z.object({
  mealIndex: z.union([z.literal(1), z.literal(2)]),
  mealLabel: z.string().optional(),
  items: z.array(z.object({
    foodId: z.string().nullable(),
    foodName: z.string().min(1),
    amountG: z.number().positive(),
    caloriesPer100g: z.number().min(0),
    proteinPer100g: z.number().min(0),
    fatPer100g: z.number().min(0),
    carbsPer100g: z.number().min(0),
    fiberPer100g: z.number().min(0),
  })).min(1, 'At least one item is required'),
});

type LogMealVariables = {
  mealIndex: 1 | 2;
  mealLabel?: string;
  items: MealItemDraft[];
  loggedAt?: Date;
};

export function useLogMeal() {
  const queryClient = useQueryClient();
  const clearItems = useAppStore((s: AppStore) => s.clearItems);

  return useMutation({
    mutationFn: async (variables: LogMealVariables) => {
      LogMealVariablesSchema.parse(variables);
      const loggedAt = variables.loggedAt ?? new Date();

      // 1. Insert the meal row
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .insert({
          logged_at: loggedAt.toISOString(),
          meal_index: variables.mealIndex,
          meal_label: variables.mealLabel ?? null,
        })
        .select('id')
        .single();

      if (mealError || !mealData) {
        throw new Error(mealError?.message ?? 'Failed to create meal');
      }

      const mealId = mealData.id;

      // 2. Batch insert meal_items
      const itemRows = variables.items.map((item) => {
        const factor = item.amountG / 100;
        return {
          meal_id: mealId,
          food_id: item.foodId,
          food_name: item.foodName,
          amount_g: item.amountG,
          calories: Math.round(item.caloriesPer100g * factor * 10) / 10,
          protein_g: Math.round(item.proteinPer100g * factor * 10) / 10,
          fat_g: Math.round(item.fatPer100g * factor * 10) / 10,
          carbs_g: Math.round(item.carbsPer100g * factor * 10) / 10,
          fiber_g: Math.round(item.fiberPer100g * factor * 10) / 10,
        };
      });

      const { error: itemsError } = await supabase
        .from('meal_items')
        .insert(itemRows);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      // 3. Increment use_count for foods that have a food_id (fire in parallel)
      const foodIds = variables.items
        .map((i) => i.foodId)
        .filter((id): id is string => id !== null);

      if (foodIds.length > 0) {
        await Promise.all(
          foodIds.map((foodId) =>
            supabase.rpc('increment_food_use_count', { p_food_id: foodId }),
          ),
        );
      }

      return mealId;
    },

    onMutate: async (variables) => {
      const dateStr = format(variables.loggedAt ?? new Date(), 'yyyy-MM-dd');

      // Cancel outgoing refetches for both caches
      await queryClient.cancelQueries({ queryKey: ['today_meals', dateStr] });
      await queryClient.cancelQueries({ queryKey: ['daily_summaries', dateStr] });

      // Snapshot previous values
      const previous = queryClient.getQueryData<MealWithItems[]>([
        'today_meals',
        dateStr,
      ]);
      const previousSummary = queryClient.getQueryData<DailySummaryRow>([
        'daily_summaries',
        dateStr,
      ]);

      // Optimistically add a temporary meal entry
      const loggedAt = (variables.loggedAt ?? new Date()).toISOString();
      const optimisticTs = Date.now();
      const optimisticMeal: MealWithItems = {
        id: `optimistic-${optimisticTs}`,
        user_id: '',
        logged_at: loggedAt,
        meal_index: variables.mealIndex,
        meal_label: variables.mealLabel ?? null,
        notes: null,
        created_at: loggedAt,
        updated_at: loggedAt,
        meal_items: variables.items.map((item, idx) => {
          const factor = item.amountG / 100;
          return {
            id: `optimistic-item-${idx}`,
            meal_id: `optimistic-${optimisticTs}`,
            food_id: item.foodId,
            food_name: item.foodName,
            food_name_local: null,
            amount_g: item.amountG,
            portion_desc: null,
            calories: Math.round(item.caloriesPer100g * factor * 10) / 10,
            protein_g: Math.round(item.proteinPer100g * factor * 10) / 10,
            fat_g: Math.round(item.fatPer100g * factor * 10) / 10,
            carbs_g: Math.round(item.carbsPer100g * factor * 10) / 10,
            fiber_g: Math.round(item.fiberPer100g * factor * 10) / 10,
            created_at: loggedAt,
          };
        }),
      };

      queryClient.setQueryData<MealWithItems[]>(
        ['today_meals', dateStr],
        (old) => [...(old ?? []), optimisticMeal],
      );

      // Optimistically update daily summary totals
      const totals = variables.items.reduce(
        (acc, item) => {
          const factor = item.amountG / 100;
          return {
            total_calories: acc.total_calories + Math.round(item.caloriesPer100g * factor * 10) / 10,
            total_protein_g: acc.total_protein_g + Math.round(item.proteinPer100g * factor * 10) / 10,
            total_fat_g: acc.total_fat_g + Math.round(item.fatPer100g * factor * 10) / 10,
            total_carbs_g: acc.total_carbs_g + Math.round(item.carbsPer100g * factor * 10) / 10,
          };
        },
        { total_calories: 0, total_protein_g: 0, total_fat_g: 0, total_carbs_g: 0 },
      );

      queryClient.setQueryData<DailySummaryRow>(
        ['daily_summaries', dateStr],
        (old: DailySummaryRow | undefined) =>
          old
            ? {
                ...old,
                total_calories: (old.total_calories ?? 0) + totals.total_calories,
                total_protein_g: (old.total_protein_g ?? 0) + totals.total_protein_g,
                total_fat_g: (old.total_fat_g ?? 0) + totals.total_fat_g,
                total_carbs_g: (old.total_carbs_g ?? 0) + totals.total_carbs_g,
              }
            : old,
      );

      return { previous, previousSummary, dateStr };
    },

    onError: (_err, _variables, context) => {
      // Roll back optimistic updates — do NOT clear items so user can retry
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          ['today_meals', context.dateStr],
          context.previous,
        );
      }
      if (context?.previousSummary !== undefined) {
        queryClient.setQueryData(
          ['daily_summaries', context.dateStr],
          context.previousSummary,
        );
      }
    },

    onSettled: (_mealId, err, variables, context) => {
      const dateStr = context?.dateStr ?? format(variables.loggedAt ?? new Date(), 'yyyy-MM-dd');
      void queryClient.invalidateQueries({ queryKey: ['today_meals', dateStr] });
      void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
      void queryClient.invalidateQueries({ queryKey: ['frequent_foods'] });
      if (!err) clearItems();
    },
  });
}
