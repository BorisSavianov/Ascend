import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useElapsedTimer } from '../../lib/workoutTimer';
import {
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useActiveWorkoutSession } from '../../hooks/useActiveWorkoutSession';
import { useLastWorkoutPerformance } from '../../hooks/useLastWorkoutPerformance';
import { useFinishWorkoutSession } from '../../hooks/useFinishWorkoutSession';
import { useAddExerciseToSession } from '../../hooks/useAddExerciseToSession';
import { useRemoveExerciseFromSession } from '../../hooks/useRemoveExerciseFromSession';
import { useAddSet } from '../../hooks/useAddSet';
import { useRemoveSet } from '../../hooks/useRemoveSet';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import WorkoutExerciseCard from '../../components/WorkoutExerciseCard';
import WorkoutProgressBar from '../../components/WorkoutProgressBar';
import ConfirmationSheet from '../../components/ui/ConfirmationSheet';
import UndoToast from '../../components/ui/UndoToast';
import Surface from '../../components/ui/Surface';
import { SkeletonBox } from '../../components/ui/Skeleton';
import type { ExerciseTemplate } from '../../types/workout';
import { colors, fontFamily, motion, radius, spacing, typography } from '../../lib/theme';

const UNDO_DELAY_MS = 5000;

type PendingSetRemoval = {
  setId: string;
  loggedExerciseId: string;
  setNumber: number;
  setIndex: number;
};

type PendingExerciseRemoval = {
  loggedExerciseId: string;
  exerciseName: string;
};

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();
  const today = new Date();

  const { data: session, isLoading } = useActiveWorkoutSession();
  const { data: lastPerf } = useLastWorkoutPerformance(session?.preset_id ?? null);
  const { mutate: finish, isPending: isFinishing } = useFinishWorkoutSession();
  const { mutate: addExercise, isPending: isAddingExercise } = useAddExerciseToSession();
  const { mutate: removeExercise } = useRemoveExerciseFromSession();
  const { mutate: addSet } = useAddSet();
  const { mutate: removeSet } = useRemoveSet();

  const { initExerciseSets, sessionStartedAt, pausedAt, pausedDurationMs, pauseSession, resumeSession, resetSession } =
    useWorkoutStore();

  const elapsedLabel = useElapsedTimer(sessionStartedAt, pausedAt, pausedDurationMs);
  const isPaused = pausedAt !== null;

  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);

  // Undo state for set removal
  const [pendingSetRemoval, setPendingSetRemoval] = useState<PendingSetRemoval | null>(null);
  const setUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo state for exercise removal
  const [pendingExerciseRemoval, setPendingExerciseRemoval] = useState<PendingExerciseRemoval | null>(null);
  const exerciseUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Thin top-of-header progress bar
  const topProgress = useSharedValue(0);
  const topBarStyle = useAnimatedStyle(() => ({
    width: `${topProgress.value * 100}%`,
  }));

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

  // Cleanup undo timers on unmount
  useEffect(() => {
    return () => {
      if (setUndoTimerRef.current) clearTimeout(setUndoTimerRef.current);
      if (exerciseUndoTimerRef.current) clearTimeout(exerciseUndoTimerRef.current);
    };
  }, []);

  const handleBackPress = useCallback(() => {
    if (!session) {
      router.replace('/(tabs)/move');
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
    // Commit any pending removals before finishing
    if (pendingSetRemoval) {
      commitSetRemoval(pendingSetRemoval);
      setPendingSetRemoval(null);
    }
    if (pendingExerciseRemoval) {
      commitExerciseRemoval(pendingExerciseRemoval);
      setPendingExerciseRemoval(null);
    }
    finish(session.id, {
      onSuccess: () => {
        resetSession();
        router.replace('/(tabs)/move');
      },
    });
  }

  function handleFinishConfirmed() {
    setShowFinishConfirm(false);
    handleFinish();
  }

  // ── Set removal with undo ────────────────────────────────────────────────────

  function commitSetRemoval(pending: PendingSetRemoval) {
    removeSet({
      setId: pending.setId,
      loggedExerciseId: pending.loggedExerciseId,
      setNumber: pending.setNumber,
      setIndex: pending.setIndex,
      date: today,
    });
  }

  function handleRequestSetRemoval(setId: string, loggedExerciseId: string, setNumber: number, setIndex: number) {
    if (setUndoTimerRef.current) clearTimeout(setUndoTimerRef.current);
    if (pendingSetRemoval) commitSetRemoval(pendingSetRemoval);

    setPendingSetRemoval({ setId, loggedExerciseId, setNumber, setIndex });
    setUndoTimerRef.current = setTimeout(() => {
      setPendingSetRemoval(null);
      commitSetRemoval({ setId, loggedExerciseId, setNumber, setIndex });
    }, UNDO_DELAY_MS);
  }

  function handleUndoSetRemoval() {
    if (setUndoTimerRef.current) clearTimeout(setUndoTimerRef.current);
    setPendingSetRemoval(null);
  }

  // ── Exercise removal with undo ───────────────────────────────────────────────

  function commitExerciseRemoval(pending: PendingExerciseRemoval) {
    removeExercise({ loggedExerciseId: pending.loggedExerciseId, date: today });
  }

  function handleRequestExerciseRemoval(loggedExerciseId: string, exerciseName: string) {
    if (exerciseUndoTimerRef.current) clearTimeout(exerciseUndoTimerRef.current);
    if (pendingExerciseRemoval) commitExerciseRemoval(pendingExerciseRemoval);

    setPendingExerciseRemoval({ loggedExerciseId, exerciseName });
    exerciseUndoTimerRef.current = setTimeout(() => {
      setPendingExerciseRemoval(null);
      commitExerciseRemoval({ loggedExerciseId, exerciseName });
    }, UNDO_DELAY_MS);
  }

  function handleUndoExerciseRemoval() {
    if (exerciseUndoTimerRef.current) clearTimeout(exerciseUndoTimerRef.current);
    setPendingExerciseRemoval(null);
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

  const sessionName = session?.session_snapshot?.preset_name
    ?? `Session · ${new Date(session?.date ?? Date.now()).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'short',
      })}`;

  // Filter out pending exercise removal from visible list
  const visibleExercises = (session?.logged_exercises ?? []).filter(
    (le) => le.id !== pendingExerciseRemoval?.loggedExerciseId,
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        {/* Undo toasts */}
        {pendingExerciseRemoval ? (
          <UndoToast
            message={`"${pendingExerciseRemoval.exerciseName}" will be removed`}
            onUndo={handleUndoExerciseRemoval}
          />
        ) : pendingSetRemoval ? (
          <UndoToast
            message="Set will be removed"
            onUndo={handleUndoSetRemoval}
          />
        ) : null}

        {/* Custom header */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
          {/* Thin animated progress bar along the top edge */}
          <View style={{ height: 3, backgroundColor: colors.border.subtle, overflow: 'hidden' }}>
            <Animated.View
              style={[{ height: 3, backgroundColor: colors.intensity.primary }, topBarStyle]}
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
                {sessionName}
              </Text>
              <Text
                style={[
                  typography.caption,
                  {
                    fontFamily: fontFamily.monoRegular,
                    color: isPaused ? colors.semantic.warning : colors.intensity.primary,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {isPaused ? `Paused · ${elapsedLabel}` : elapsedLabel}
              </Text>
            </View>

            {/* Pause / Resume */}
            <Pressable
              onPress={isPaused ? resumeSession : pauseSession}
              hitSlop={8}
              style={{ padding: spacing.xs }}
              accessibilityLabel={isPaused ? 'Resume timer' : 'Pause timer'}
            >
              <Ionicons
                name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                size={22}
                color={isPaused ? colors.semantic.warning : colors.text.secondary}
              />
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
                  borderRadius: radius.lg,
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
                {[1, 2].map((j) => (
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
          <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
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
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {visibleExercises.map((le, index) => (
              <Animated.View
                key={le.id}
                entering={FadeInDown.delay(Math.min(index * 40, 280)).duration(motion.standard)}
              >
                <WorkoutExerciseCard
                  loggedExercise={le}
                  previousPerformance={lastPerf?.[le.exercise_template_id] ?? null}
                  onAddSet={() =>
                    addSet({
                      loggedExerciseId: le.id,
                      currentSetCount: le.logged_sets.length,
                      date: today,
                    })
                  }
                  onRemoveSet={(setId, setIndex) => {
                    const set = le.logged_sets[setIndex];
                    if (!set) return;
                    handleRequestSetRemoval(setId, le.id, set.set_number, setIndex);
                  }}
                  onRemoveExercise={() =>
                    handleRequestExerciseRemoval(le.id, le.exercise_template.name)
                  }
                />
              </Animated.View>
            ))}

            {/* Add exercise button */}
            <Pressable
              onPress={() => setShowAddExercise(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderStyle: 'dashed',
                marginBottom: spacing.md,
              }}
              accessibilityLabel="Add exercise"
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.text.secondary} />
              <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                {isAddingExercise ? 'Adding…' : 'Add exercise'}
              </Text>
            </Pressable>

            {/* Extra space so last card isn't hidden behind the progress bar */}
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {/* Sticky progress bar */}
        {session ? (
          <WorkoutProgressBar
            completedSets={completedSets}
            totalSets={totalSets}
            elapsedLabel={elapsedLabel}
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

      {/* Add Exercise modal */}
      {session ? (
        <AddExerciseModal
          visible={showAddExercise}
          sessionId={session.id}
          existingExerciseIds={session.logged_exercises.map((le) => le.exercise_template_id)}
          nextSortOrder={session.logged_exercises.length + 1}
          date={today}
          onAdd={(templateId, defaultSets) => {
            addExercise(
              {
                sessionId: session.id,
                exerciseTemplateId: templateId,
                sortOrder: session.logged_exercises.length + 1,
                defaultSets,
                date: today,
              },
              { onSuccess: () => setShowAddExercise(false) },
            );
          }}
          onClose={() => setShowAddExercise(false)}
        />
      ) : null}
    </>
  );
}

// ── Add Exercise Modal ────────────────────────────────────────────────────────

function AddExerciseModal({
  visible,
  sessionId: _sessionId,
  existingExerciseIds,
  nextSortOrder: _nextSortOrder,
  date: _date,
  onAdd,
  onClose,
}: {
  visible: boolean;
  sessionId: string;
  existingExerciseIds: string[];
  nextSortOrder: number;
  date: Date;
  onAdd: (templateId: string, defaultSets: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['exercise_templates'],
    queryFn: async (): Promise<ExerciseTemplate[]> => {
      const { data, error } = await supabase
        .from('exercise_templates')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.canvas,
          paddingTop: insets.top + spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
            gap: spacing.md,
          }}
        >
          <Text style={[typography.h2, { flex: 1 }]}>Add exercise</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBox key={i} width="100%" height={52} borderRadius={radius.md} />
            ))}
          </View>
        ) : (
          <FlatList
            data={templates}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm }}
            renderItem={({ item: template }) => {
              const alreadyAdded = existingExerciseIds.includes(template.id);
              return (
                <Pressable
                  onPress={() => !alreadyAdded && onAdd(template.id, template.target_sets)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border.subtle,
                    backgroundColor: alreadyAdded
                      ? colors.bg.surfaceRaised
                      : colors.bg.surface,
                    opacity: alreadyAdded ? 0.5 : 1,
                  }}
                  accessibilityLabel={template.name}
                  disabled={alreadyAdded}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body} numberOfLines={1}>
                      {template.name}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.text.tertiary, textTransform: 'capitalize' },
                      ]}
                    >
                      {template.muscle_group.replace('_', ' ')} · {template.equipment}
                    </Text>
                  </View>
                  {alreadyAdded ? (
                    <Text style={[typography.caption, { color: colors.text.disabled }]}>
                      Added
                    </Text>
                  ) : (
                    <Ionicons name="add" size={20} color={colors.text.secondary} />
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
