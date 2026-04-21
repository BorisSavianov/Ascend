import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { format } from 'date-fns';
import { router } from 'expo-router';
import ExerciseRowComponent from '../../../components/ExerciseRow';
import { useExercises } from '../../../hooks/useExercises';
import { useLogExercise } from '../../../hooks/useLogExercise';
import { useTodayAssignment } from '../../../hooks/useTodayAssignment';
import { useWorkoutPresets } from '../../../hooks/useWorkoutPresets';
import { useActiveWorkoutSession } from '../../../hooks/useActiveWorkoutSession';
import { useStartWorkoutSession } from '../../../hooks/useStartWorkoutSession';
import { useWorkoutStore } from '../../../store/useWorkoutStore';
import { useElapsedTimer } from '../../../lib/workoutTimer';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { logger } from '../../../lib/logger';
import { EXERCISE_PRESETS } from '../../../constants/exercises';
import { estimateCalories } from '../../../lib/calorieEstimator';
import { useBodyWeightKg } from '../../../hooks/useBodyWeightKg';
import type { ExerciseRow } from '../../../types/database';
import Screen from '../../../components/ui/Screen';
import Chip from '../../../components/ui/Chip';
import Surface from '../../../components/ui/Surface';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import UndoToast from '../../../components/ui/UndoToast';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import AppHeader from '../../../components/ui/AppHeader';
import { colors, fontFamily, radius, spacing, typography } from '../../../lib/theme';
import { SkeletonBox } from '../../../components/ui/Skeleton';

type Preset = (typeof EXERCISE_PRESETS)[number];

export default function MoveScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load move screen">
      <MoveScreenContent />
    </ErrorBoundary>
  );
}

const UNDO_DELAY_MS = 5000;

function MoveScreenContent() {
  const today = new Date();
  const queryClient = useQueryClient();
  const cardioScrollRef = useRef<ScrollView | null>(null);

  // ── Workout data (new preset-based schema) ──────────────────────────────────
  const { data: todayAssignment, isLoading: dayLoading } = useTodayAssignment(today);
  const { data: presets = [], isLoading: presetsLoading } = useWorkoutPresets();
  const { data: activeSession } = useActiveWorkoutSession(today);
  const { mutate: startSession, isPending: isStarting } = useStartWorkoutSession();
  const { sessionStartedAt, pausedAt } = useWorkoutStore();
  const elapsedLabel = useElapsedTimer(
    activeSession ? (sessionStartedAt ?? activeSession.started_at) : null,
    pausedAt,
  );

  const bodyWeightKg = useBodyWeightKg();
  const [showCardio, setShowCardio] = useState(false);
  const isUnseeded = !presetsLoading && presets.length === 0;

  // Auto-expand cardio on rest days (no preset assigned)
  useEffect(() => {
    if (!dayLoading && todayAssignment?.preset === null) {
      setShowCardio(true);
    }
  }, [dayLoading, todayAssignment?.preset]);

  // ── Cardio logger data ──────────────────────────────────────────────────────
  const { data: exercises = [] } = useExercises(today);
  const { mutate: logExercise, isPending } = useLogExercise();

  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [name, setName] = useState('');
  const [durationText, setDurationText] = useState('');
  const [caloriesText, setCaloriesText] = useState('');
  const [linkToWorkout, setLinkToWorkout] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ExerciseRow | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const commitDelete = useCallback(
    async (exercise: ExerciseRow) => {
      const { error } = await supabase.from('exercises').delete().eq('id', exercise.id);
      if (error) {
        logger.warn('Delete exercise error:', error.message);
        return;
      }
      const dateStr = format(new Date(exercise.logged_at), 'yyyy-MM-dd');
      void queryClient.invalidateQueries({ queryKey: ['exercises', dateStr] });
      void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
    },
    [queryClient],
  );

  const handleRequestDelete = useCallback(
    (exercise: ExerciseRow) => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (pendingDelete) void commitDelete(pendingDelete);
      setPendingDelete(exercise);
      undoTimerRef.current = setTimeout(() => {
        setPendingDelete(null);
        void commitDelete(exercise);
      }, UNDO_DELAY_MS);
    },
    [pendingDelete, commitDelete],
  );

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingDelete(null);
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  function handleSelectPreset(preset: Preset) {
    setSelectedPreset(preset);
    setName(preset.name);
    const dur = preset.defaultDuration;
    setDurationText(String(dur));
    setCaloriesText(String(estimateCalories(preset.met, dur, bodyWeightKg)));
  }

  function handleDurationChange(text: string) {
    setDurationText(text);
    if (selectedPreset) {
      const dur = parseInt(text, 10);
      if (!isNaN(dur) && dur > 0) {
        setCaloriesText(String(estimateCalories(selectedPreset.met, dur, bodyWeightKg)));
      }
    }
  }

  function handleLog() {
    const dur = parseInt(durationText, 10);
    const cal = parseInt(caloriesText, 10);
    if (!name.trim() || isNaN(dur) || dur <= 0 || isNaN(cal) || cal < 0) return;
    logExercise(
      {
        name: name.trim(),
        category: selectedPreset?.category,
        durationMin: dur,
        caloriesBurned: cal,
        workoutSessionId: linkToWorkout && activeSession ? activeSession.id : null,
      },
      {
        onSuccess: () => {
          setSelectedPreset(null);
          setName('');
          setDurationText('');
          setCaloriesText('');
          setLinkToWorkout(false);
        },
      },
    );
  }

  function handleStartWorkout() {
    if (!todayAssignment?.preset) return;
    startSession(
      { preset: todayAssignment.preset, date: today },
      {
        onSuccess: ({ sessionId }) => router.push(`/workout/${sessionId}`),
      },
    );
  }

  function handleStartEmptyWorkout() {
    startSession(
      { preset: null, date: today },
      {
        onSuccess: ({ sessionId }) => router.push(`/workout/${sessionId}`),
      },
    );
  }

  function handleResumeWorkout() {
    if (!activeSession) return;
    router.push(`/workout/${activeSession.id}`);
  }

  async function handleSeedPresets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setIsSeeding(true);
    const { error } = await supabase.rpc('seed_workout_presets', { p_user_id: user.id });
    if (error) {
      logger.warn('Preset seed error:', error.message);
    } else {
      void queryClient.invalidateQueries({ queryKey: ['workout_presets'] });
      void queryClient.invalidateQueries({ queryKey: ['day_assignment'] });
      void queryClient.invalidateQueries({ queryKey: ['week_assignments'] });
    }
    setIsSeeding(false);
  }

  const canLog =
    name.trim().length > 0 && parseInt(durationText, 10) > 0 && parseInt(caloriesText, 10) >= 0;

  const preset = todayAssignment?.preset ?? null;
  const isRestDay = !dayLoading && preset === null;

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: 132 }}>
      {pendingDelete ? (
        <UndoToast message={`"${pendingDelete.name}" will be deleted`} onUndo={handleUndo} />
      ) : null}

      <AppHeader
        title="Move"
        eyebrow={format(today, 'EEEE, d MMMM')}
        subtitle="Today's workout"
      />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>

        {/* ── Segmented control ──────────────────────────────────────────────── */}
        <SegmentedControl
          options={[
            { label: 'Today', value: 'today' },
            { label: 'History', value: 'history' },
            { label: 'Templates', value: 'templates' },
          ]}
          value="today"
          onChange={(v) => {
            if (v === 'history') router.push('/(tabs)/move/history');
            if (v === 'templates') router.push('/(tabs)/move/templates');
          }}
        />

        {/* ── Workout Section ────────────────────────────────────────────────── */}
        {dayLoading || presetsLoading ? (
          <Surface>
            <View style={{ gap: spacing.md }}>
              <SkeletonBox width="55%" height={20} />
              <SkeletonBox width="38%" height={13} />
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <SkeletonBox width="52%" height={14} />
                    <SkeletonBox width={60} height={14} />
                  </View>
                ))}
              </View>
              <SkeletonBox width="100%" height={56} borderRadius={radius.md} style={{ marginTop: spacing.sm }} />
            </View>
          </Surface>
        ) : (
          <Animated.View entering={FadeInDown.duration(200)}>
            {isUnseeded ? (
              /* No presets — prompt user to set up their week */
              <Surface>
                <Text style={typography.h3}>Set up your week</Text>
                <Text style={[typography.bodySm, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
                  Get started with a default Push / Pull / Legs programme, or{' '}
                  <Text
                    style={[typography.bodySm, { color: colors.accent.primary }]}
                    onPress={() => router.push('/(tabs)/move/templates')}
                  >
                    manage your templates
                  </Text>
                  .
                </Text>
                <Button
                  label="Set up default programme"
                  onPress={handleSeedPresets}
                  loading={isSeeding}
                />
              </Surface>
            ) : activeSession ? (
              /* Active session in progress — show resume banner */
              <Surface elevated gradient="intensity">
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: radius.pill,
                        backgroundColor: colors.intensity.primary,
                      }}
                    />
                    <Text style={[typography.label, { color: colors.intensity.primary }]}>
                      Workout in progress · {elapsedLabel}
                    </Text>
                  </View>
                  <Text style={typography.h3}>
                    {activeSession.session_snapshot?.preset_name ?? preset?.name ?? 'Workout'}
                  </Text>
                  <Button label="Resume workout" onPress={handleResumeWorkout} variant="intensity" />
                </View>
              </Surface>
            ) : isRestDay ? (
              /* Rest day — no preset assigned */
              <Surface>
                <Text style={typography.h3}>Rest day</Text>
                <Text style={[typography.bodySm, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
                  No workout scheduled today. Log some cardio below, or start an ad-hoc session.
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Button
                    label="Log cardio"
                    onPress={() => {
                      setShowCardio(true);
                      setTimeout(() => cardioScrollRef.current?.scrollToEnd?.({ animated: true }), 100);
                    }}
                    variant="secondary"
                    size="md"
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Ad-hoc workout"
                    onPress={handleStartEmptyWorkout}
                    loading={isStarting}
                    variant="secondary"
                    size="md"
                    style={{ flex: 1 }}
                  />
                </View>
              </Surface>
            ) : preset ? (
              /* Training day — show preset preview + start button */
              <Surface elevated gradient="intensity">
                <View style={{ gap: spacing.lg }}>
                  <View style={{ gap: spacing.xs }}>
                    <Text style={typography.h3}>{preset.name}</Text>
                    <Text style={typography.bodySm}>
                      {preset.exercises.length} exercises · {preset.exercises.reduce(
                        (sum, ex) => sum + ex.default_sets,
                        0,
                      )} total sets
                    </Text>
                  </View>

                  {/* Exercise preview list (truncated at 5) */}
                  <View style={{ gap: spacing.sm }}>
                    {preset.exercises.slice(0, 5).map((ex, i) => (
                      <Animated.View
                        key={ex.id}
                        entering={FadeInDown.delay(i * 60).duration(250).springify()}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={[typography.bodySm, { flex: 1 }]} numberOfLines={1}>
                          {ex.exercise_template.name}
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: colors.text.tertiary,
                              fontFamily: fontFamily.monoRegular,
                              fontVariant: ['tabular-nums'],
                            },
                          ]}
                        >
                          {ex.default_sets} × {ex.default_reps_min}–{ex.default_reps_max}
                        </Text>
                      </Animated.View>
                    ))}
                    {preset.exercises.length > 5 ? (
                      <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                        +{preset.exercises.length - 5} more
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <Button
                      label="Start workout"
                      onPress={handleStartWorkout}
                      loading={isStarting}
                      variant="intensity"
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="History"
                      onPress={() => router.push('/(tabs)/move/history')}
                      variant="secondary"
                      size="md"
                    />
                  </View>
                </View>
              </Surface>
            ) : null}
          </Animated.View>
        )}

        {/* ── Cardio Logger (collapsible) ─────────────────────────────────────── */}
        <View>
          <Pressable
            onPress={() => setShowCardio((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.sm,
            }}
            accessibilityRole="button"
            accessibilityLabel={showCardio ? 'Collapse cardio section' : 'Expand cardio section'}
          >
            <Text style={typography.label}>Log cardio / activity</Text>
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>
              {showCardio ? '▲' : '▼'}
            </Text>
          </Pressable>

          {showCardio ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(140)}
              style={{ gap: spacing.xl, marginTop: spacing.sm }}
            >
              <View>
                <Text style={typography.label}>Quick presets</Text>
                <ScrollView
                  ref={cardioScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingTop: spacing.md,
                    paddingBottom: spacing.sm,
                    gap: spacing.sm,
                  }}
                >
                  {EXERCISE_PRESETS.map((p) => (
                    <Chip
                      key={p.name}
                      label={p.name}
                      onPress={() => handleSelectPreset(p)}
                      selected={selectedPreset?.name === p.name}
                    />
                  ))}
                </ScrollView>
              </View>

              <Surface elevated>
                <Text style={typography.h3}>Log activity</Text>
                <View style={{ marginTop: spacing.lg, gap: spacing.lg }}>
                  <TextField
                    label="Exercise"
                    value={name}
                    onChangeText={setName}
                    placeholder="Walking"
                    returnKeyType="next"
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <TextField
                      label="Duration"
                      value={durationText}
                      onChangeText={handleDurationChange}
                      placeholder="30"
                      keyboardType="number-pad"
                      unit="min"
                      style={{ flex: 1 }}
                    />
                    <TextField
                      label="Calories"
                      value={caloriesText}
                      onChangeText={setCaloriesText}
                      placeholder="0"
                      keyboardType="number-pad"
                      unit="kcal"
                      style={{ flex: 1 }}
                    />
                  </View>
                  {activeSession ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={typography.bodySm}>Link to active workout</Text>
                      <Switch
                        value={linkToWorkout}
                        onValueChange={setLinkToWorkout}
                        trackColor={{ true: colors.intensity.primary }}
                      />
                    </View>
                  ) : null}
                  <Button
                    label="Log exercise"
                    onPress={handleLog}
                    disabled={!canLog}
                    loading={isPending}
                  />
                </View>
              </Surface>

              {exercises.length > 0 ? (
                <Surface style={{ padding: 0, overflow: 'hidden' }}>
                  <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                    <Text style={typography.h3}>Today's activity</Text>
                    <Text
                      style={[
                        typography.caption,
                        { marginTop: spacing.xs, marginBottom: spacing.md },
                      ]}
                    >
                      Logged movement contributing to your daily net calories.
                    </Text>
                  </View>
                  {exercises.map((exercise) => (
                    <ExerciseRowComponent
                      key={exercise.id}
                      exercise={exercise}
                      onRequestDelete={handleRequestDelete}
                    />
                  ))}
                </Surface>
              ) : (
                <Surface>
                  <Text style={typography.h3}>No activity logged yet</Text>
                  <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                    Use a preset or type an activity to start building your movement log.
                  </Text>
                </Surface>
              )}
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

