import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { router } from 'expo-router';
import ExerciseRowComponent from '../../components/ExerciseRow';
import RestDayCard from '../../components/RestDayCard';
import WorkoutHistorySheet from '../../components/WorkoutHistorySheet';
import { useExercises } from '../../hooks/useExercises';
import { useLogExercise } from '../../hooks/useLogExercise';
import { useDailySummary } from '../../hooks/useDailySummary';
import { useWorkoutDay } from '../../hooks/useWorkoutDay';
import { useActiveWorkoutSession } from '../../hooks/useActiveWorkoutSession';
import { useStartWorkoutSession } from '../../hooks/useStartWorkoutSession';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { useLastWorkoutPerformance } from '../../hooks/useLastWorkoutPerformance';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { EXERCISE_PRESETS } from '../../constants/exercises';
import type { ExerciseRow } from '../../types/database';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Chip from '../../components/ui/Chip';
import Surface from '../../components/ui/Surface';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import UndoToast from '../../components/ui/UndoToast';
import { colors, spacing, typography } from '../../lib/theme';

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

  // ── Workout program data ────────────────────────────────────────────────────
  const { data: workoutDay, isLoading: dayLoading } = useWorkoutDay(today);
  const { data: activeSession } = useActiveWorkoutSession(today);
  const { mutate: startSession, isPending: isStarting } = useStartWorkoutSession();
  const { data: history = [], isLoading: historyLoading } = useWorkoutHistory(
    workoutDay?.id ?? null,
  );
  useLastWorkoutPerformance(workoutDay?.is_rest_day ? null : (workoutDay?.id ?? null));

  const [showHistory, setShowHistory] = useState(false);
  const [showCardio, setShowCardio] = useState(false);

  // Auto-expand cardio section on rest days
  useEffect(() => {
    if (workoutDay?.is_rest_day) {
      setShowCardio(true);
    }
  }, [workoutDay?.is_rest_day]);

  // ── Cardio logger data ──────────────────────────────────────────────────────
  const { data: exercises = [] } = useExercises(today);
  const { data: summary } = useDailySummary(today);
  const { mutate: logExercise, isPending } = useLogExercise();

  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [name, setName] = useState('');
  const [durationText, setDurationText] = useState('');
  const [caloriesText, setCaloriesText] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ExerciseRow | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setCaloriesText(String(preset.kcalPerMin * dur));
  }

  function handleDurationChange(text: string) {
    setDurationText(text);
    if (selectedPreset) {
      const dur = parseInt(text, 10);
      if (!isNaN(dur) && dur > 0) {
        setCaloriesText(String(selectedPreset.kcalPerMin * dur));
      }
    }
  }

  function handleLog() {
    const dur = parseInt(durationText, 10);
    const cal = parseInt(caloriesText, 10);
    if (!name.trim() || isNaN(dur) || dur <= 0 || isNaN(cal) || cal < 0) return;
    logExercise(
      { name: name.trim(), category: selectedPreset?.category, durationMin: dur, caloriesBurned: cal },
      {
        onSuccess: () => {
          setSelectedPreset(null);
          setName('');
          setDurationText('');
          setCaloriesText('');
        },
      },
    );
  }

  function handleStartWorkout() {
    if (!workoutDay || workoutDay.is_rest_day) return;
    startSession(
      { workoutDay, date: today },
      {
        onSuccess: ({ sessionId }) => router.push(`/workout/${sessionId}`),
      },
    );
  }

  function handleResumeWorkout() {
    if (!activeSession) return;
    router.push(`/workout/${activeSession.id}`);
  }

  const totalFoodCalories = summary?.total_calories ?? 0;
  const totalExerciseCalories = exercises.reduce((sum, e) => sum + (e.calories_burned ?? 0), 0);
  const netCalories = totalFoodCalories - totalExerciseCalories;
  const canLog =
    name.trim().length > 0 && parseInt(durationText, 10) > 0 && parseInt(caloriesText, 10) >= 0;

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: 132 }}>
      {pendingDelete ? (
        <UndoToast message={`"${pendingDelete.name}" will be deleted`} onUndo={handleUndo} />
      ) : null}

      <AppHeader
        title="Move"
        eyebrow={format(today, 'EEEE, d MMMM')}
        subtitle="Today's workout program"
      />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>

        {/* ── Workout Program Section ─────────────────────────────────────── */}
        {dayLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={colors.accent.primary} />
          </View>
        ) : !workoutDay ? (
          <Surface>
            <Text style={typography.h3}>Program not set up</Text>
            <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
              Your workout program could not be loaded. Try restarting the app.
            </Text>
          </Surface>
        ) : workoutDay.is_rest_day ? (
          <RestDayCard
            dayName={workoutDay.name}
            onLogCardio={() => {
              setShowCardio(true);
              // Scroll to cardio section after state update
              setTimeout(() => cardioScrollRef.current?.scrollToEnd?.({ animated: true }), 100);
            }}
          />
        ) : activeSession ? (
          /* Active session in progress — show resume banner */
          <Surface elevated>
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.semantic.warning,
                  }}
                />
                <Text style={[typography.label, { color: colors.semantic.warning }]}>
                  Workout in progress
                </Text>
              </View>
              <Text style={typography.h3}>{workoutDay.name}</Text>
              <Button label="Resume workout" onPress={handleResumeWorkout} />
            </View>
          </Surface>
        ) : (
          /* Training day, no active session — show preview + start button */
          <Surface>
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={typography.h3}>{workoutDay.name}</Text>
                <Text style={typography.bodySm}>
                  {workoutDay.exercises.length} exercises · {workoutDay.exercises.reduce(
                    (sum, ex) => sum + (ex.target_sets ?? 2),
                    0,
                  )} total sets
                </Text>
              </View>

              {/* Exercise preview list */}
              <View style={{ gap: spacing.sm }}>
                {workoutDay.exercises.map((ex) => {
                  const targetSets = ex.target_sets ?? ex.exercise_template.target_sets;
                  const repsMin = ex.target_reps_min ?? ex.exercise_template.target_reps_min;
                  const repsMax = ex.target_reps_max ?? ex.exercise_template.target_reps_max;
                  return (
                    <View
                      key={ex.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={[typography.bodySm, { flex: 1 }]} numberOfLines={1}>
                        {ex.exercise_template.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                        {targetSets} × {repsMin}–{repsMax}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button
                  label="Start workout"
                  onPress={handleStartWorkout}
                  loading={isStarting}
                  style={{ flex: 1 }}
                />
                <Button
                  label="History"
                  onPress={() => setShowHistory(true)}
                  variant="secondary"
                  size="md"
                />
              </View>
            </View>
          </Surface>
        )}

        {/* ── Net energy summary ──────────────────────────────────────────── */}
        <Surface>
          <Text style={typography.h3}>Net energy today</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <SummaryCard label="Food" value={`${Math.round(totalFoodCalories)}`} />
            <SummaryCard
              label="Exercise"
              value={`${Math.round(totalExerciseCalories)}`}
              tint={colors.semantic.warning}
            />
            <SummaryCard
              label="Net"
              value={`${Math.round(netCalories)}`}
              tint={colors.accent.primary}
            />
          </View>
        </Surface>

        {/* ── Cardio Logger (collapsible) ─────────────────────────────────── */}
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
            <View style={{ gap: spacing.xl, marginTop: spacing.sm }}>
              <View>
                <Text style={typography.label}>Quick presets</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingTop: spacing.md,
                    paddingBottom: spacing.sm,
                    gap: spacing.sm,
                  }}
                >
                  {EXERCISE_PRESETS.map((preset) => (
                    <Chip
                      key={preset.name}
                      label={preset.name}
                      onPress={() => handleSelectPreset(preset)}
                      selected={selectedPreset?.name === preset.name}
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
            </View>
          ) : null}
        </View>
      </View>

      {/* History sheet */}
      {workoutDay && !workoutDay.is_rest_day ? (
        <WorkoutHistorySheet
          visible={showHistory}
          workoutDayName={workoutDay.name}
          sessions={history}
          isLoading={historyLoading}
          onClose={() => setShowHistory(false)}
        />
      ) : null}
    </Screen>
  );
}

function SummaryCard({
  label,
  value,
  tint = colors.text.primary,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 84,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.bg.surfaceRaised,
        padding: spacing.lg,
        justifyContent: 'space-between',
      }}
    >
      <Text style={typography.caption}>{label}</Text>
      <Text
        style={[
          typography.h3,
          { color: tint, fontVariant: ['tabular-nums'] },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
