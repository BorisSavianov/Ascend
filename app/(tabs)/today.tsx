import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { format, isToday, subDays, addDays, isSameDay } from 'date-fns';
import { useDailySummary } from '../../hooks/useDailySummary';
import { useDeleteMeal } from '../../hooks/useDeleteMeal';
import { useTodayMeals, type MealWithItems } from '../../hooks/useTodayMeals';
import { useWeeklyTrends } from '../../hooks/useWeeklyTrends';
import { useAppStore } from '../../store/useAppStore';
import { formatCalories } from '../../lib/calculations';
import { useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/ui/Screen';
import Button from '../../components/ui/Button';
import UndoToast from '../../components/ui/UndoToast';
import { SkeletonBox } from '../../components/ui/Skeleton';
import { colors, fontFamily, radius, spacing, typography } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function TodayScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load today screen">
      <TodayScreenContent />
    </ErrorBoundary>
  );
}

const UNDO_DELAY_MS = 5000;

function TodayScreenContent() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const atToday = isToday(selectedDate);
  const [pendingMealDelete, setPendingMealDelete] = useState<MealWithItems | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: summary, isFetching: summaryFetching } = useDailySummary(selectedDate);
  const { data: meals = [], isFetching: mealsFetching, refetch } = useTodayMeals(selectedDate);
  const { data: weeklyData = [] } = useWeeklyTrends();
  const calorieTarget = useAppStore((s) => s.calorieTarget);
  const macroTargets = useAppStore((s) => s.macroTargets);
  const { mutate: deleteMeal } = useDeleteMeal();

  const isRefreshing = summaryFetching || mealsFetching;

  useEffect(() => {
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, []);

  function navigateDate(delta: -1 | 1) {
    setSelectedDate((d) => delta === -1 ? subDays(d, 1) : addDays(d, 1));
  }

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
    void queryClient.invalidateQueries({ queryKey: ['today_meals', dateStr] });
    void queryClient.invalidateQueries({ queryKey: ['weekly_trends'] });
    refetch();
  }

  const commitDeleteMeal = useCallback((meal: MealWithItems) => {
    deleteMeal({ mealId: meal.id, loggedAt: meal.logged_at });
  }, [deleteMeal]);

  function handleRequestDeleteMeal(meal: MealWithItems) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (pendingMealDelete) commitDeleteMeal(pendingMealDelete);
    setPendingMealDelete(meal);
    undoTimerRef.current = setTimeout(() => {
      setPendingMealDelete(null);
      commitDeleteMeal(meal);
    }, UNDO_DELAY_MS);
  }

  function handleUndoMealDelete() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingMealDelete(null);
  }

  const consumed = summary?.total_calories ?? 0;
  const proteinG  = summary?.total_protein_g ?? 0;
  const fatG      = summary?.total_fat_g ?? 0;
  const carbsG    = summary?.total_carbs_g ?? 0;
  const summaryExt = summary as (typeof summary & {
    net_calories?: number | null;
    exercise_calories_burned?: number | null;
  }) | undefined;
  const exerciseCalories = summaryExt?.exercise_calories_burned ?? 0;
  const netCalories      = summaryExt?.net_calories ?? consumed;
  const leftToTarget     = Math.max(calorieTarget - netCalories, 0);
  const ringPct          = calorieTarget > 0 ? Math.min(1, netCalories / calorieTarget) : 0;

  // Build 7-day strip using weeklyData
  const today = new Date();
  const stripDays = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
  const weeklyMap = new Map(weeklyData.map((d) => [d.log_date, d.total_calories]));

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 132 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <View>
            <Text style={[typography.label, { color: colors.text.tertiary, marginBottom: spacing.xs }]}>
              {format(selectedDate, 'EEE · d MMM')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text style={typography.h1}>
                {atToday ? 'Today' : format(selectedDate, 'EEEE')}
              </Text>
              <Text style={[typography.caption, { color: colors.text.disabled, fontSize: 10 }]}>
                v1.2.0
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Pressable
              onPress={() => navigateDate(-1)}
              style={{
                width: 36, height: 36, borderRadius: radius.sm,
                backgroundColor: colors.bg.surface,
                borderWidth: 1, borderColor: colors.border.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}
              accessibilityLabel="Previous day"
            >
              <Ionicons name="chevron-back" size={16} color={colors.text.secondary} />
            </Pressable>
            <Pressable
              onPress={() => { if (!atToday) navigateDate(1); }}
              style={{
                width: 36, height: 36, borderRadius: radius.sm,
                backgroundColor: atToday ? colors.bg.surface : colors.bg.surfaceRaised,
                borderWidth: 1, borderColor: atToday ? colors.border.subtle : colors.border.default,
                alignItems: 'center', justifyContent: 'center',
              }}
              accessibilityLabel="Next day"
              accessibilityState={{ disabled: atToday }}
            >
              <Ionicons name="chevron-forward" size={16} color={atToday ? colors.text.disabled : colors.text.secondary} />
            </Pressable>
          </View>
        </View>

        {/* ── 7-day strip ── */}
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {stripDays.map((day, i) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const kcal = (weeklyMap.get(dayStr) ?? 0) as number;
              const barPct = calorieTarget > 0 ? Math.min(1.1, kcal / calorieTarget) : 0;
              const isSelected = isSameDay(day, selectedDate);
              const isOver = kcal > calorieTarget && calorieTarget > 0;

              return (
                <Pressable
                  key={i}
                  onPress={() => setSelectedDate(day)}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.border.default : colors.border.subtle,
                    backgroundColor: isSelected ? colors.bg.surface : 'transparent',
                    paddingVertical: spacing.sm,
                    paddingHorizontal: 4,
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Text style={{
                    fontSize: 10, fontWeight: '500',
                    fontFamily: fontFamily.medium,
                    color: isSelected ? colors.text.secondary : colors.text.disabled,
                  }}>
                    {format(day, 'EEE').charAt(0)}
                  </Text>
                  <View style={{ width: '100%', height: 24, justifyContent: 'flex-end' }}>
                    {kcal > 0 && (
                      <View style={{
                        width: '100%',
                        height: Math.max(3, barPct * 24),
                        backgroundColor: isOver ? colors.intensity.primary : colors.accent.primary,
                        opacity: isSelected ? 1 : 0.45,
                        borderRadius: 3,
                      }} />
                    )}
                  </View>
                  <Text style={{
                    fontSize: 9,
                    fontFamily: fontFamily.monoMedium,
                    color: isSelected ? colors.text.primary : colors.text.disabled,
                    fontVariant: ['tabular-nums'],
                  }}>
                    {kcal > 0 ? `${(kcal / 1000).toFixed(1)}k` : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {/* ── Net energy hero card ── */}
          <View style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: 'rgba(143, 179, 255, 0.18)',
            overflow: 'hidden',
          }}>
            <LinearGradient
              colors={['#15181E', '#12203A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.3, y: 1 }}
              style={{ padding: spacing.xl }}
            >
              {summaryFetching && consumed === 0 ? (
                <SkeletonBox width="100%" height={120} borderRadius={radius.md} />
              ) : (
                <>
                  {/* Top row: metric + ring */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.label, { color: colors.text.tertiary, marginBottom: spacing.sm }]}>
                        Net energy
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[typography.metricHero, { lineHeight: 52 }]}>
                          {netCalories.toLocaleString()}
                        </Text>
                        <Text style={[typography.bodySm, { color: colors.text.tertiary, marginBottom: 6 }]}>
                          / {calorieTarget.toLocaleString()} kcal
                        </Text>
                      </View>
                      <Text style={[typography.bodySm, { marginTop: 4 }]}>
                        <Text style={{ color: colors.accent.primary }}>{leftToTarget.toLocaleString()}</Text>
                        <Text style={{ color: colors.text.tertiary }}> left to target</Text>
                      </Text>
                    </View>
                    <NetRing pct={ringPct} />
                  </View>

                  {/* Consumed / Burned */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
                    <MiniStat
                      label="Consumed"
                      value={formatCalories(consumed)}
                      unit="kcal"
                      accentColor={colors.accent.primary}
                      muteColor={colors.accent.primaryMuted}
                    />
                    <MiniStat
                      label="Burned"
                      value={formatCalories(exerciseCalories)}
                      unit="kcal"
                      accentColor={colors.intensity.primary}
                      muteColor={colors.intensity.muted}
                    />
                  </View>

                  {/* Macros */}
                  <View style={{ marginTop: spacing.lg }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                      <Text style={typography.label}>Macros</Text>
                      <Text style={[typography.caption, { color: colors.text.disabled }]}>g · % target</Text>
                    </View>
                    <MacroProgressRow name="Protein" val={proteinG}  target={macroTargets.protein} color={colors.accent.primary} />
                    <MacroProgressRow name="Carbs"   val={carbsG}    target={macroTargets.carbs}   color="#A78BFA" />
                    <MacroProgressRow name="Fat"     val={fatG}      target={macroTargets.fat}     color={colors.intensity.primary} />
                  </View>
                </>
              )}
            </LinearGradient>
          </View>

          {/* ── Movement card (shown when exercise logged) ── */}
          {exerciseCalories > 0 && (
            <View style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: 'rgba(255, 155, 90, 0.20)',
              overflow: 'hidden',
            }}>
              <LinearGradient
                colors={['#15181E', '#1E1408']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.3, y: 1 }}
                style={{ padding: spacing.xl }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.label}>Movement</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.sm }}>
                      <Text style={typography.metricMd}>{formatCalories(exerciseCalories)}</Text>
                      <Text style={[typography.bodySm, { color: colors.text.tertiary }]}>kcal burned</Text>
                    </View>
                  </View>
                  <View style={{
                    width: 44, height: 44, borderRadius: radius.md,
                    backgroundColor: colors.intensity.muted,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="barbell-outline" size={22} color={colors.intensity.primary} />
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* ── Meals ── */}
          <View>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: spacing.md, marginTop: spacing.xs,
            }}>
              <Text style={typography.h3}>Meals</Text>
              <Text style={typography.caption}>{meals.length} logged</Text>
            </View>

            {meals.length === 0 ? (
              <View style={{
                padding: spacing.xl,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.border.default,
                alignItems: 'center',
              }}>
                <Text style={[typography.bodySm, { color: colors.text.tertiary, textAlign: 'center' }]}>
                  No meals logged yet
                </Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    onDelete={() => handleRequestDeleteMeal(meal)}
                    isPendingDelete={pendingMealDelete?.id === meal.id}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {pendingMealDelete ? (
        <UndoToast
          message={`${pendingMealDelete.meal_label ?? 'Meal'} will be deleted`}
          onUndo={handleUndoMealDelete}
        />
      ) : null}
    </Screen>
  );
}

// ── Net ring (small, shows % only) ──────────────────────────────────────────
function NetRing({ pct }: { pct: number }) {
  const size = 72;
  const strokeWidth = 6;
  const margin = strokeWidth / 2 + 2;
  const rect = { x: margin, y: margin, width: size - margin * 2, height: size - margin * 2 };

  const bgPath = Skia.Path.Make();
  bgPath.addArc(rect, -90, 359.99);

  const fillDeg = Math.max(0.01, Math.min(359.99, pct * 359.99));
  const fgPath = Skia.Path.Make();
  fgPath.addArc(rect, -90, fillDeg);

  return (
    <View style={{ width: size, height: size, position: 'relative', marginLeft: spacing.md }}>
      <Canvas style={{ width: size, height: size }}>
        <Path path={bgPath} style="stroke" strokeWidth={strokeWidth} color={colors.bg.surfaceOverlay} strokeCap="round" />
        <Path path={fgPath} style="stroke" strokeWidth={strokeWidth} color={colors.accent.primary} strokeCap="round" />
      </Canvas>
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{
          fontSize: 13, fontWeight: '600',
          fontFamily: fontFamily.displaySemi,
          color: colors.text.primary,
          fontVariant: ['tabular-nums'],
        }}>
          {Math.round(pct * 100)}%
        </Text>
      </View>
    </View>
  );
}

// ── Mini stat cards in hero ─────────────────────────────────────────────────
function MiniStat({
  label, value, unit, accentColor,
}: {
  label: string; value: string; unit: string; accentColor: string; muteColor: string;
}) {
  return (
    <View style={{
      flex: 1,
      padding: spacing.md,
      backgroundColor: colors.bg.surfaceRaised,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
        <View style={{ width: 6, height: 6, borderRadius: radius.pill, backgroundColor: accentColor }} />
        <Text style={typography.label}>{label}</Text>
      </View>
      <Text style={typography.metricMd}>{value}</Text>
      <Text style={[typography.caption, { marginTop: 2 }]}>{unit}</Text>
    </View>
  );
}

// ── Macro progress row ───────────────────────────────────────────────────────
function MacroProgressRow({ name, val, target, color }: {
  name: string; val: number; target: number; color: string;
}) {
  const pct = target > 0 ? Math.min(1, val / target) : 0;
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={[typography.bodySm, { fontFamily: fontFamily.medium, color: colors.text.secondary }]}>{name}</Text>
        <Text style={[typography.caption, { fontVariant: ['tabular-nums'] }]}>
          <Text style={{ color: colors.text.primary, fontFamily: fontFamily.monoMedium }}>{Math.round(val)}</Text>
          <Text style={{ color: colors.text.disabled }}>/{Math.round(target)}g · {Math.round(pct * 100)}%</Text>
        </Text>
      </View>
      <View style={{ height: 5, backgroundColor: colors.bg.surfaceOverlay, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ── Meal card ────────────────────────────────────────────────────────────────
type MealCardProps = {
  meal: MealWithItems;
  onDelete: () => void;
  isPendingDelete?: boolean;
};

function MealCard({ meal, onDelete, isPendingDelete = false }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalCalories = meal.meal_items.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein  = meal.meal_items.reduce((sum, item) => sum + (item.protein_g ?? 0), 0);
  const foodNames     = meal.meal_items.map((i) => i.food_name);

  return (
    <Animated.View layout={LinearTransition.duration(180)}>
      <View style={{
        backgroundColor: colors.bg.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        overflow: 'hidden',
      }}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={meal.meal_label ?? `Meal ${meal.sort_order}`}
          accessibilityState={{ expanded }}
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          {/* Time */}
          <Text style={{
            width: 40,
            fontSize: 12, fontFamily: fontFamily.monoMedium,
            color: colors.text.disabled,
            fontVariant: ['tabular-nums'],
          }}>
            {format(new Date(meal.logged_at), 'HH:mm')}
          </Text>

          {/* Name + preview */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.bodySm, { fontFamily: fontFamily.medium, color: colors.text.primary }]}>
              {meal.meal_label ?? `Meal ${meal.sort_order}`}
            </Text>
            <Text
              style={[typography.caption, { marginTop: 2 }]}
              numberOfLines={1}
            >
              {foodNames.slice(0, 3).join(' · ')}
              {foodNames.length > 3 ? ` +${foodNames.length - 3}` : ''}
            </Text>
          </View>

          {/* Calories + protein */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typography.metricSm, { color: colors.text.primary }]}>
              {formatCalories(totalCalories)}
            </Text>
            <Text style={[typography.caption, { marginTop: 1 }]}>
              kcal · {Math.round(totalProtein)}P
            </Text>
          </View>

          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.text.disabled}
          />
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
              gap: spacing.xs,
            }}
          >
            {meal.meal_items.map((item) => (
              <View
                key={item.id}
                style={{
                  paddingTop: spacing.md,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={typography.bodySm}>{item.food_name}</Text>
                  {item.amount_g != null && (
                    <Text style={[typography.caption, { marginTop: 2 }]}>{item.amount_g}g</Text>
                  )}
                </View>
                <Text style={[typography.caption, { color: colors.text.secondary, fontVariant: ['tabular-nums'] }]}>
                  {formatCalories(item.calories)} kcal
                </Text>
              </View>
            ))}
            <Button
              label={isPendingDelete ? 'Deleting…' : 'Delete meal'}
              onPress={onDelete}
              variant="ghost"
              disabled={isPendingDelete}
            />
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}
