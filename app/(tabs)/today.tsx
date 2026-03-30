import React, { useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import CalorieRing from '../../components/CalorieRing';
import MacroBar from '../../components/MacroBar';
import WeeklyChart from '../../components/WeeklyChart';
import EmptyState from '../../components/EmptyState';
import { useDailySummary } from '../../hooks/useDailySummary';
import { useTodayMeals, type MealWithItems } from '../../hooks/useTodayMeals';
import { useWeeklyTrends } from '../../hooks/useWeeklyTrends';
import { useAppStore } from '../../store/useAppStore';
import { formatCalories } from '../../lib/calculations';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export default function TodayScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load today screen">
      <TodayScreenContent />
    </ErrorBoundary>
  );
}

function TodayScreenContent() {
  const queryClient = useQueryClient();
  const today = new Date();
  const dateStr = format(today, 'yyyy-MM-dd');

  const { data: summary, isFetching: summaryFetching } = useDailySummary(today);
  const { data: meals, isFetching: mealsFetching, refetch } = useTodayMeals(today);
  const { data: weeklyData } = useWeeklyTrends();
  const calorieTarget = useAppStore((s) => s.calorieTarget);
  const macroTargets = useAppStore((s) => s.macroTargets);

  const isRefreshing = summaryFetching || mealsFetching;

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
    void queryClient.invalidateQueries({ queryKey: ['today_meals', dateStr] });
    void queryClient.invalidateQueries({ queryKey: ['weekly_trends'] });
    refetch();
  }

  async function handleDeleteMeal(mealId: string) {
    const { error } = await supabase.from('meals').delete().eq('id', mealId);
    if (error) {
      if (__DEV__) {
        console.warn('Delete meal error:', error.message);
      }
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['today_meals', dateStr] });
    void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
  }

  function confirmDeleteMeal(mealId: string) {
    Alert.alert('Delete meal', 'Remove this meal and all its items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { void handleDeleteMeal(mealId); },
      },
    ]);
  }

  const consumed = summary?.total_calories ?? 0;
  const proteinG = summary?.total_protein_g ?? 0;
  const fatG = summary?.total_fat_g ?? 0;
  const carbsG = summary?.total_carbs_g ?? 0;
  // net_calories and exercise_calories_burned are added in migration 006
  const summaryExt = summary as (typeof summary & { net_calories?: number | null; exercise_calories_burned?: number | null }) | undefined;
  const exerciseCalories = summaryExt?.exercise_calories_burned ?? 0;
  const netCalories = summaryExt?.net_calories ?? consumed;

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#22c55e"
          />
        }
      >
        {/* Date header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-gray-400 text-sm uppercase tracking-widest">
            {format(today, 'EEEE, d MMMM')}
          </Text>
        </View>

        {/* Calorie ring */}
        <View className="items-center py-4">
          <CalorieRing
            consumed={consumed}
            target={calorieTarget}
            size={180}
          />
        </View>

        {/* Macro bar */}
        <View className="mx-4 mb-4 bg-gray-900 rounded-2xl px-4 py-3">
          <MacroBar
            proteinG={proteinG}
            fatG={fatG}
            carbsG={carbsG}
            targets={macroTargets}
          />
          {exerciseCalories > 0 ? (
            <Text className="text-gray-400 text-xs text-center mt-2">
              Net:{' '}
              <Text className="text-white font-semibold">
                {formatCalories(netCalories)} kcal
              </Text>
              {' '}({formatCalories(consumed)} − {formatCalories(exerciseCalories)} exercise)
            </Text>
          ) : null}
        </View>

        {/* Meals section */}
        <View className="px-4">
          <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
            Meals
          </Text>

          {meals.length === 0 ? (
            <EmptyState message="No meals logged today. Tap Log to start." />
          ) : (
            meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={() => confirmDeleteMeal(meal.id)}
              />
            ))
          )}
        </View>

        {/* Weekly chart */}
        <View className="mx-4 mt-6 mb-4 bg-gray-900 rounded-2xl px-4 pt-3 pb-2">
          <Text className="text-gray-500 text-xs uppercase tracking-widest mb-2">
            This week
          </Text>
          <WeeklyChart
            data={weeklyData
              .filter((d) => d.log_date != null && d.total_calories != null)
              .map((d) => ({
                log_date: d.log_date as string,
                total_calories: d.total_calories as number,
              }))}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type MealCardProps = {
  meal: MealWithItems;
  onDelete: () => void;
};

function MealCard({ meal, onDelete }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalCalories = meal.meal_items.reduce(
    (sum, item) => sum + item.calories,
    0,
  );

  const foodNames = meal.meal_items.map((i) => i.food_name);
  const displayNames =
    foodNames.length > 3
      ? `${foodNames.slice(0, 3).join(', ')} and ${foodNames.length - 3} more`
      : foodNames.join(', ');

  return (
    <View className="bg-gray-900 rounded-2xl mb-3 overflow-hidden">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center px-4 py-3"
      >
        <View className="flex-1">
          <Text className="text-white font-semibold text-base">
            Meal {meal.meal_index}
            {meal.meal_label ? ` · ${meal.meal_label}` : ''}
          </Text>
          <Text className="text-gray-400 text-xs mt-0.5">
            {format(new Date(meal.logged_at), 'HH:mm')}
          </Text>
          <Text className="text-gray-500 text-sm mt-1" numberOfLines={1}>
            {displayNames || '—'}
          </Text>
        </View>
        <Text className="text-white font-semibold text-base mr-3">
          {formatCalories(totalCalories)}
        </Text>
        <Text className="text-gray-400 text-lg">{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View className="border-t border-gray-800">
          {meal.meal_items.map((item) => (
            <View
              key={item.id}
              className="flex-row justify-between px-4 py-2 border-b border-gray-800"
            >
              <View className="flex-1">
                <Text className="text-white text-sm">{item.food_name}</Text>
                {item.amount_g != null ? (
                  <Text className="text-gray-500 text-xs">{item.amount_g}g</Text>
                ) : null}
              </View>
              <Text className="text-gray-300 text-sm">
                {formatCalories(item.calories)} kcal
              </Text>
            </View>
          ))}
          <Pressable
            onPress={onDelete}
            className="flex-row justify-center items-center py-3"
          >
            <Text className="text-red-400 text-sm font-medium">
              Delete meal
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
