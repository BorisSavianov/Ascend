import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
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
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import ConfirmationSheet from '../../components/ui/ConfirmationSheet';
import { colors, spacing, typography } from '../../lib/theme';

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
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);

  const { data: summary, isFetching: summaryFetching } = useDailySummary(today);
  const { data: meals, isFetching: mealsFetching, refetch } = useTodayMeals(today);
  const { data: weeklyData = [] } = useWeeklyTrends();
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
    setMealToDelete(null);
    void queryClient.invalidateQueries({ queryKey: ['today_meals', dateStr] });
    void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
  }

  const consumed = summary?.total_calories ?? 0;
  const proteinG = summary?.total_protein_g ?? 0;
  const fatG = summary?.total_fat_g ?? 0;
  const carbsG = summary?.total_carbs_g ?? 0;
  const summaryExt = summary as (typeof summary & {
    net_calories?: number | null;
    exercise_calories_burned?: number | null;
  }) | undefined;
  const exerciseCalories = summaryExt?.exercise_calories_burned ?? 0;
  const netCalories = summaryExt?.net_calories ?? consumed;

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 132,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
          />
        }
      >
        <AppHeader
          title="Today"
          eyebrow={format(today, 'EEEE, d MMMM')}
          subtitle="A calmer view of what you’ve logged and what still matters today."
        />

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>
          <Surface elevated overlay>
            <View style={{ alignItems: 'center' }}>
              <CalorieRing consumed={consumed} target={calorieTarget} />
            </View>

            <View
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                marginTop: spacing.xl,
              }}
            >
              <MetricCard
                label="Net"
                value={`${formatCalories(netCalories)}`}
                tone={exerciseCalories > 0 ? 'accent' : 'default'}
              />
              <MetricCard
                label="Exercise"
                value={`${formatCalories(exerciseCalories)}`}
                tone="default"
              />
              <MetricCard
                label="Target"
                value={`${formatCalories(calorieTarget)}`}
                tone="default"
              />
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Text style={typography.label}>Macro balance</Text>
              <View style={{ marginTop: spacing.md }}>
                <MacroBar
                  proteinG={proteinG}
                  fatG={fatG}
                  carbsG={carbsG}
                  targets={macroTargets}
                />
              </View>
            </View>
          </Surface>

          <View>
            <Text style={typography.h3}>Meals</Text>
            <Text style={[typography.caption, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
              Expand any meal to review items or remove it from today.
            </Text>
            {meals.length === 0 ? (
              <EmptyState
                title="No meals logged"
                message="Use the Log tab to add your first meal and the day summary will populate here."
              />
            ) : (
              <View style={{ gap: spacing.md }}>
                {meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    onDelete={() => setMealToDelete(meal.id)}
                  />
                ))}
              </View>
            )}
          </View>

          <Surface>
            <Text style={typography.h3}>This week</Text>
            <Text style={[typography.caption, { marginTop: spacing.xs }]}>
              Daily intake pattern across the last seven entries.
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <WeeklyChart
                data={weeklyData
                  .filter((d) => d.log_date != null && d.total_calories != null)
                  .map((d) => ({
                    log_date: d.log_date as string,
                    total_calories: d.total_calories as number,
                  }))}
              />
            </View>
          </Surface>
        </View>
      </ScrollView>

      <ConfirmationSheet
        visible={mealToDelete != null}
        title="Delete meal"
        description="Remove this meal and all of its logged items from today."
        confirmLabel="Delete meal"
        tone="danger"
        onCancel={() => setMealToDelete(null)}
        onConfirm={() => {
          if (mealToDelete) {
            void handleDeleteMeal(mealToDelete);
          }
        }}
      />
    </Screen>
  );
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent';
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 88,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tone === 'accent' ? colors.accent.primary : colors.border.subtle,
        backgroundColor: tone === 'accent' ? colors.accent.primaryMuted : colors.bg.surface,
        padding: spacing.lg,
        justifyContent: 'space-between',
      }}
    >
      <Text style={typography.caption}>{label}</Text>
      <Text
        style={[
          typography.h3,
          {
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

type MealCardProps = {
  meal: MealWithItems;
  onDelete: () => void;
};

function MealCard({ meal, onDelete }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalCalories = meal.meal_items.reduce((sum, item) => sum + item.calories, 0);
  const foodNames = meal.meal_items.map((i) => i.food_name);
  const previewNames = foodNames.slice(0, 3);

  return (
    <Animated.View layout={LinearTransition.duration(180)}>
      <Surface style={{ padding: 0, overflow: 'hidden' }} elevated={expanded}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>
                Meal {meal.meal_index}
                {meal.meal_label ? ` · ${meal.meal_label}` : ''}
              </Text>
              <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                {format(new Date(meal.logged_at), 'HH:mm')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[
                  typography.label,
                  {
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {formatCalories(totalCalories)} kcal
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.text.tertiary}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {previewNames.map((name) => (
              <View
                key={name}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 999,
                  backgroundColor: colors.bg.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                }}
              >
                <Text style={typography.caption}>{name}</Text>
              </View>
            ))}
            {foodNames.length > 3 ? (
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 999,
                  backgroundColor: colors.bg.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                }}
              >
                <Text style={typography.caption}>+{foodNames.length - 3} more</Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        {expanded ? (
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutUp.duration(140)}
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border.subtle,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
              gap: spacing.sm,
            }}
          >
            {meal.meal_items.map((item) => (
              <View
                key={item.id}
                style={{
                  minHeight: 52,
                  paddingTop: spacing.md,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={typography.bodySm}>{item.food_name}</Text>
                  {item.amount_g != null ? (
                    <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                      {item.amount_g}g
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    typography.caption,
                    {
                      color: colors.text.secondary,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                >
                  {formatCalories(item.calories)} kcal
                </Text>
              </View>
            ))}
            <Button
              label="Delete meal"
              onPress={onDelete}
              variant="ghost"
            />
          </Animated.View>
        ) : null}
      </Surface>
    </Animated.View>
  );
}
