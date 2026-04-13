import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  Text,
  View,
  Pressable,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useActiveWorkoutSession } from '../../hooks/useActiveWorkoutSession';
import { useLastWorkoutPerformance } from '../../hooks/useLastWorkoutPerformance';
import { useFinishWorkoutSession } from '../../hooks/useFinishWorkoutSession';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import WorkoutExerciseCard from '../../components/WorkoutExerciseCard';
import WorkoutProgressBar from '../../components/WorkoutProgressBar';
import WorkoutHistorySheet from '../../components/WorkoutHistorySheet';
import ConfirmationSheet from '../../components/ui/ConfirmationSheet';
import Surface from '../../components/ui/Surface';
import { SkeletonBox } from '../../components/ui/Skeleton';
import { colors, fontFamily, motion, spacing, typography } from '../../lib/theme';
import type { WorkoutDayExercise } from '../../types/workout';

export default function WorkoutSessionScreen() {
  useLocalSearchParams<{ sessionId: string }>();

  const insets = useSafeAreaInsets();

  const { data: session, isLoading } = useActiveWorkoutSession();
  const { data: lastPerf } = useLastWorkoutPerformance(session?.workout_day_id ?? null);
  const { data: history = [], isLoading: historyLoading } = useWorkoutHistory(
    session?.workout_day_id ?? null,
  );
  const { mutate: finish, isPending: isFinishing } = useFinishWorkoutSession();
  const { initExerciseSets } = useWorkoutStore();

  const [elapsed, setElapsed] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Thin top-of-header progress bar
  const topProgress = useSharedValue(0);
  const topBarStyle = useAnimatedStyle(() => ({
    width: `${topProgress.value * 100}%`,
  }));

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialise Zustand set inputs when session data loads
  useEffect(() => {
    if (!session) return;
    session.logged_exercises.forEach((le) => {
      const prevPerf = lastPerf?.[le.exercise_template_id];
      initExerciseSets(
        le.id,
        le.logged_sets.length,
        prevPerf?.sets.map((s) => ({ weight_kg: s.weight_kg, reps: s.reps })) ?? null,
      );
    });
  }, [session?.id, lastPerf]);

  // Android hardware back button intercept
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => handler.remove();
  }, [session]);

  const handleBackPress = useCallback(() => {
    if (!session) {
      router.back();
      return;
    }
    const anyIncomplete = session.logged_exercises.some((le) =>
      le.logged_sets.some((s) => !s.is_completed),
    );
    if (anyIncomplete) {
      setShowFinishConfirm(true);
    } else {
      handleFinish();
    }
  }, [session]);

  function handleFinish() {
    if (!session) return;
    finish(session.id, {
      onSuccess: () => router.back(),
    });
  }

  function handleFinishConfirmed() {
    setShowFinishConfirm(false);
    handleFinish();
  }

  const totalSets =
    session?.logged_exercises.reduce((sum, le) => sum + le.logged_sets.length, 0) ?? 0;
  const completedSets =
    session?.logged_exercises.reduce(
      (sum, le) => sum + le.logged_sets.filter((s) => s.is_completed).length,
      0,
    ) ?? 0;

  useEffect(() => {
    const fraction = totalSets > 0 ? completedSets / totalSets : 0;
    topProgress.value = withTiming(fraction, { duration: motion.standard });
  }, [completedSets, totalSets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a map from exercise_template_id to WorkoutDayExercise for target data
  // We don't have workoutDay data here, but we can reconstruct targets from
  // the logged_sets count since pre-creation used the correct target_sets.
  // For target_reps_min/max we fall back to the template defaults.
  // A more complete approach would fetch workout_day_exercises separately,
  // but for now we use exercise_template defaults which is sufficient.
  type LoggedEx = NonNullable<typeof session>['logged_exercises'][0];
  function makeFallbackDayExercise(le: LoggedEx): WorkoutDayExercise {
    return {
      id: le.id,
      workout_day_id: session?.workout_day_id ?? '',
      exercise_template_id: le.exercise_template_id,
      sort_order: le.sort_order,
      target_sets: le.logged_sets.length,
      target_reps_min: le.exercise_template.target_reps_min,
      target_reps_max: le.exercise_template.target_reps_max,
      exercise_template: le.exercise_template,
    };
  }

  const dayName = session
    ? `Session · ${new Date(session.date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })}`
    : 'Workout';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        {/* Custom header */}
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
          }}
        >
          {/* Thin animated progress bar along the top edge */}
          <View
            style={{
              height: 3,
              backgroundColor: colors.border.subtle,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={[
                {
                  height: 3,
                  backgroundColor: colors.intensity.primary,
                },
                topBarStyle,
              ]}
            />
          </View>

          <View
            style={{
              paddingTop: insets.top + spacing.sm,
              paddingBottom: spacing.md,
              paddingHorizontal: spacing.xl,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Pressable
              onPress={handleBackPress}
              hitSlop={8}
              style={{ padding: spacing.xs }}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={typography.h2} numberOfLines={1}>
                {dayName}
              </Text>
              <Text
                style={[
                  typography.caption,
                  {
                    fontFamily: fontFamily.monoRegular,
                    color: colors.intensity.primary,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowHistory(true)}
              hitSlop={8}
              style={{ padding: spacing.xs }}
              accessibilityLabel="View history"
            >
              <Ionicons name="time-outline" size={22} color={colors.text.secondary} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {isLoading ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          >
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                  backgroundColor: colors.bg.surface,
                  padding: spacing.lg,
                  gap: spacing.md,
                  marginBottom: spacing.md,
                }}
              >
                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <SkeletonBox width={52} height={52} borderRadius={12} />
                  <View style={{ flex: 1, gap: spacing.sm }}>
                    <SkeletonBox width="65%" height={16} />
                    <SkeletonBox width="45%" height={12} />
                  </View>
                </View>
                {[1, 2, 3].map((j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <SkeletonBox width={28} height={36} />
                    <SkeletonBox width={68} height={36} />
                    <SkeletonBox height={36} style={{ flex: 1 }} />
                    <SkeletonBox width={52} height={36} />
                    <SkeletonBox width={44} height={36} borderRadius={999} />
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : !session ? (
          <View
            style={{
              flex: 1,
              padding: spacing.xl,
              justifyContent: 'center',
            }}
          >
            <Surface>
              <Text style={typography.h3}>Session not found</Text>
              <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                This workout session may have already ended.
              </Text>
            </Surface>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: spacing.xl,
              paddingBottom: spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {session.logged_exercises.map((le) => (
              <WorkoutExerciseCard
                key={le.id}
                loggedExercise={le}
                workoutDayExercise={makeFallbackDayExercise(le)}
                previousPerformance={
                  lastPerf?.[le.exercise_template_id] ?? null
                }
              />
            ))}
            {/* Extra space so last card isn't hidden behind the progress bar */}
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {/* Sticky progress bar */}
        {session ? (
          <WorkoutProgressBar
            completedSets={completedSets}
            totalSets={totalSets}
            elapsedSeconds={elapsed}
            onFinish={handleFinish}
            isFinishing={isFinishing}
          />
        ) : null}
      </View>

      {/* Confirmation sheet for back button with incomplete sets */}
      <ConfirmationSheet
        visible={showFinishConfirm}
        title="Finish workout?"
        description="You still have incomplete sets. Finish anyway?"
        confirmLabel="Finish workout"
        cancelLabel="Keep going"
        onConfirm={handleFinishConfirmed}
        onCancel={() => setShowFinishConfirm(false)}
      />

      {/* History bottom sheet */}
      {session ? (
        <WorkoutHistorySheet
          visible={showHistory}
          workoutDayName={dayName}
          sessions={history}
          isLoading={historyLoading}
          onClose={() => setShowHistory(false)}
        />
      ) : null}
    </>
  );
}
