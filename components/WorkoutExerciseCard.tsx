import React, { useEffect, useRef } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { colors, fontFamily, gradients, radius, shadows, spacing, typography } from '../lib/theme';
import { EXERCISE_IMAGES, MUSCLE_GROUP_ICONS } from '../constants/exerciseImages';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useLogSet } from '../hooks/useLogSet';
import WorkoutSetRow from './WorkoutSetRow';
import type { LoggedExercise, PreviousExercisePerformance } from '../types/workout';

type Props = {
  loggedExercise: LoggedExercise;
  previousPerformance: PreviousExercisePerformance | null;
  onAddSet: () => void;
  onRemoveSet: (setId: string, setIndex: number) => void;
  onRemoveExercise: () => void;
};

export default function WorkoutExerciseCard({
  loggedExercise,
  previousPerformance,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
}: Props) {
  const { exercise_template: template, logged_sets: sets } = loggedExercise;
  const targetSets = sets.length > 0 ? sets.length : template.target_sets;
  const targetRepsMin = template.target_reps_min;
  const targetRepsMax = template.target_reps_max;

  const { setInputs, collapsedExerciseIds, initExerciseSets, updateSetInput, markSetCompleted, toggleExerciseCollapsed } =
    useWorkoutStore();
  const { mutate: logSet } = useLogSet();

  const leId = loggedExercise.id;
  const inputs = setInputs[leId] ?? [];
  const isCollapsed = collapsedExerciseIds.has(leId);

  // Initialise set inputs from server data on first render
  useEffect(() => {
    initExerciseSets(
      leId,
      sets.length,
      previousPerformance?.sets.map((s) => ({
        weight_kg: s.weight_kg,
        reps: s.reps,
      })) ?? null,
    );
  }, [leId, sets.length, previousPerformance]);

  // Sync completed state from server data into store
  useEffect(() => {
    sets.forEach((s, i) => {
      if (s.is_completed && inputs[i] && !inputs[i].isCompleted) {
        markSetCompleted(leId, i, true);
      }
    });
  }, [sets, leId]);

  // Auto-collapse 600ms after all sets are completed
  const autoCollapseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedCount = inputs.filter((s) => s.isCompleted).length;
  useEffect(() => {
    if (completedCount === targetSets && targetSets > 0 && !isCollapsed) {
      autoCollapseRef.current = setTimeout(() => {
        toggleExerciseCollapsed(leId);
      }, 600);
    }
    return () => {
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
    };
  }, [completedCount, targetSets]);

  const imageSource = template.image_key ? EXERCISE_IMAGES[template.image_key] : undefined;
  const fallbackIcon = template.muscle_group
    ? (MUSCLE_GROUP_ICONS[template.muscle_group] ?? 'barbell-outline')
    : 'barbell-outline';

  const allComplete = completedCount === targetSets && targetSets > 0;

  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: allComplete ? colors.intensity.primary + '55' : colors.border.subtle,
        overflow: 'hidden',
        marginBottom: spacing.md,
        ...(shadows.md),
      }}
    >
    <LinearGradient
      colors={gradients.intensity}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* ── Header ── */}
      <Pressable
        onPress={() => toggleExerciseCollapsed(leId)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          gap: spacing.md,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${template.name}, ${isCollapsed ? 'expand' : 'collapse'}`}
      >
        {/* Exercise image or fallback icon */}
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.sm,
            backgroundColor: colors.intensity.muted,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {imageSource ? (
            <Image
              source={imageSource}
              style={{ width: 52, height: 52 }}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name={fallbackIcon as any} size={24} color={colors.intensity.primary} />
          )}
        </View>

        {/* Name + meta */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={typography.body} numberOfLines={1}>
            {template.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Text style={[typography.caption, { textTransform: 'capitalize' }]}>
              {template.muscle_group.replace('_', ' ')}
            </Text>
            <Text style={[typography.caption, { color: colors.border.strong }]}>·</Text>
            <Text style={[typography.caption, { textTransform: 'capitalize' }]}>
              {template.equipment}
            </Text>
            <Text style={[typography.caption, { color: colors.border.strong }]}>·</Text>
            <Text
              style={[
                typography.caption,
                { fontFamily: fontFamily.monoRegular, fontVariant: ['tabular-nums'] },
              ]}
            >
              {targetSets} × {targetRepsMin}–{targetRepsMax}
            </Text>
          </View>
        </View>

        {/* Set completion badge + collapse icon + remove exercise */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text
            style={[
              typography.caption,
              {
                color: allComplete ? colors.semantic.success : colors.text.tertiary,
                fontFamily: fontFamily.monoMedium,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {completedCount}/{targetSets}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Pressable
              onPress={onRemoveExercise}
              hitSlop={8}
              accessibilityLabel={`Remove ${template.name}`}
            >
              <Ionicons name="trash-outline" size={14} color={colors.text.disabled} />
            </Pressable>
            <Ionicons
              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
              size={14}
              color={colors.text.tertiary}
            />
          </View>
        </View>
      </Pressable>

      {/* ── Set table ── (hidden when collapsed) */}
      {!isCollapsed ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(140)}
        >
          {/* Column headers */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xs,
              gap: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border.subtle,
            }}
          >
            <Text style={[typography.caption, { width: 28, textAlign: 'center' }]}>
              Set
            </Text>
            <Text style={[typography.caption, { width: 68, textAlign: 'center' }]}>
              Prev
            </Text>
            <Text style={[typography.caption, { flex: 1, textAlign: 'center' }]}>
              Weight
            </Text>
            <Text style={[typography.caption, { width: 8 }]} />
            <Text style={[typography.caption, { width: 52, textAlign: 'center' }]}>
              Reps
            </Text>
            <Text style={[typography.caption, { width: 44, textAlign: 'center' }]}>
              Done
            </Text>
            {/* Spacer for remove icon column */}
            <View style={{ width: 32, marginRight: spacing.sm }} />
          </View>

          {/* Set rows */}
          {sets.map((set, i) => {
            const input = inputs[i] ?? {
              weight: '',
              reps: '',
              rpe: '',
              isCompleted: false,
              isSaving: false,
            };
            const prevSet = previousPerformance?.sets[i];

            return (
              <View
                key={set.id}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ flex: 1 }}>
                  <WorkoutSetRow
                    setNumber={set.set_number}
                    targetRepsMin={targetRepsMin}
                    targetRepsMax={targetRepsMax}
                    previousWeightKg={prevSet?.weight_kg ?? null}
                    previousReps={prevSet?.reps ?? null}
                    inputState={input}
                    onWeightChange={(v) => updateSetInput(leId, i, 'weight', v)}
                    onRepsChange={(v) => updateSetInput(leId, i, 'reps', v)}
                    onToggleComplete={() => {
                      const newCompleted = !input.isCompleted;
                      logSet({
                        setId: set.id,
                        loggedExerciseId: leId,
                        setNumber: set.set_number,
                        weightKg: input.weight ? parseFloat(input.weight) : null,
                        reps: input.reps ? parseInt(input.reps, 10) : null,
                        rpe: null,
                        isCompleted: newCompleted,
                      });
                    }}
                  />
                </View>
                {/* Remove set button */}
                {sets.length > 1 ? (
                  <Pressable
                    onPress={() => onRemoveSet(set.id, i)}
                    hitSlop={8}
                    style={{
                      width: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing.sm,
                    }}
                    accessibilityLabel={`Remove set ${set.set_number}`}
                  >
                    <Ionicons name="remove-circle-outline" size={18} color={colors.text.disabled} />
                  </Pressable>
                ) : (
                  <View style={{ width: 32, marginRight: spacing.sm }} />
                )}
              </View>
            );
          })}

          {/* Add set button */}
          <Pressable
            onPress={onAddSet}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.sm,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.border.subtle,
              borderStyle: 'dashed',
            }}
            accessibilityLabel="Add set"
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.text.tertiary} />
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>Add set</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </LinearGradient>
    </View>
  );
}
