import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import UndoToast from '../../components/ui/UndoToast';
import ConfirmationSheet from '../../components/ui/ConfirmationSheet';
import ExercisePickerSheet from '../../components/ExercisePickerSheet';
import { usePresetExercises } from '../../hooks/usePresetExercises';
import { useUpdatePreset } from '../../hooks/useUpdatePreset';
import { useUpdatePresetExercise } from '../../hooks/useUpdatePresetExercise';
import { useRemovePresetExercise } from '../../hooks/useRemovePresetExercise';
import { useDeletePreset } from '../../hooks/useDeletePreset';
import { colors, fontFamily, radius, spacing, typography } from '../../lib/theme';
import type { WorkoutPresetExercise } from '../../types/workout';

const UNDO_DELAY_MS = 5000;

type ExerciseRowProps = {
  exercise: WorkoutPresetExercise;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  presetId: string;
};

function ExerciseRow({ exercise, expanded, onToggle, onRemove, presetId }: ExerciseRowProps) {
  const [sets, setSets] = useState(String(exercise.default_sets));
  const [repsMin, setRepsMin] = useState(String(exercise.default_reps_min));
  const [repsMax, setRepsMax] = useState(String(exercise.default_reps_max));
  const [weightKg, setWeightKg] = useState(
    exercise.default_weight_kg != null ? String(exercise.default_weight_kg) : '',
  );
  const { mutate: updateExercise } = useUpdatePresetExercise();

  useEffect(() => {
    setSets(String(exercise.default_sets));
    setRepsMin(String(exercise.default_reps_min));
    setRepsMax(String(exercise.default_reps_max));
    setWeightKg(exercise.default_weight_kg != null ? String(exercise.default_weight_kg) : '');
  }, [exercise.default_sets, exercise.default_reps_min, exercise.default_reps_max, exercise.default_weight_kg]);

  function saveField() {
    const s = parseInt(sets, 10);
    const rMin = parseInt(repsMin, 10);
    const rMax = parseInt(repsMax, 10);
    if (isNaN(s) || isNaN(rMin) || isNaN(rMax)) return;
    updateExercise({
      id: exercise.id,
      presetId,
      defaultSets: s,
      defaultRepsMin: rMin,
      defaultRepsMax: rMax,
      defaultWeightKg: weightKg.trim() ? parseFloat(weightKg) : null,
    });
  }

  return (
    <Surface>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>
          {exercise.exercise_template.name}
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.monoRegular,
            fontSize: 14,
            lineHeight: 18,
            color: colors.text.tertiary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {exercise.default_sets} × {exercise.default_reps_min}–{exercise.default_reps_max}
        </Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
        </Pressable>
      </Pressable>

      {expanded ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ height: 1, backgroundColor: colors.border.subtle, marginBottom: spacing.xs }} />
          {[
            { label: 'Sets', value: sets, setter: setSets },
            { label: 'Reps min', value: repsMin, setter: setRepsMin },
            { label: 'Reps max', value: repsMax, setter: setRepsMax },
          ].map(({ label, value, setter }) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text style={[typography.label, { width: 72 }]}>{label}</Text>
              <TextInput
                value={value}
                onChangeText={setter}
                onEndEditing={saveField}
                keyboardType="numeric"
                style={{
                  flex: 1,
                  backgroundColor: colors.bg.input,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  borderRadius: radius.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  fontFamily: fontFamily.monoRegular,
                  fontSize: 14,
                  color: colors.text.primary,
                }}
              />
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={[typography.label, { width: 72 }]}>Weight kg</Text>
            <TextInput
              value={weightKg}
              onChangeText={setWeightKg}
              onEndEditing={saveField}
              keyboardType="numeric"
              placeholder="optional"
              placeholderTextColor={colors.text.disabled}
              style={{
                flex: 1,
                backgroundColor: colors.bg.input,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: radius.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontFamily: fontFamily.monoRegular,
                fontSize: 14,
                color: colors.text.primary,
              }}
            />
          </View>
        </View>
      ) : null}
    </Surface>
  );
}

export default function PresetEditorScreen() {
  const { presetId, name: initialName } = useLocalSearchParams<{ presetId: string; name: string }>();
  const [presetName, setPresetName] = useState(initialName ?? '');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<WorkoutPresetExercise | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedNameRef = useRef(initialName ?? '');

  const { data: exercises = [] } = usePresetExercises(presetId);
  const { mutate: updatePreset } = useUpdatePreset();
  const { mutate: removeExercise } = useRemovePresetExercise();
  const { mutate: deletePreset } = useDeletePreset();

  const visibleExercises = pendingRemove
    ? exercises.filter((e) => e.id !== pendingRemove.id)
    : exercises;

  const commitRemove = useCallback(
    (exercise: WorkoutPresetExercise) => {
      removeExercise({ id: exercise.id, presetId });
    },
    [removeExercise, presetId],
  );

  function handleRequestRemove(exercise: WorkoutPresetExercise) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (pendingRemove) commitRemove(pendingRemove);
    setPendingRemove(exercise);
    undoTimerRef.current = setTimeout(() => {
      setPendingRemove(null);
      commitRemove(exercise);
    }, UNDO_DELAY_MS);
  }

  function handleUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingRemove(null);
  }

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  function handleNameBlur() {
    if (presetName.trim() && presetName !== savedNameRef.current) {
      savedNameRef.current = presetName;
      updatePreset({ id: presetId, name: presetName.trim() });
    }
  }

  function handleDeleteConfirm() {
    deletePreset(presetId);
    router.back();
  }

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: 132 }}>
      {pendingRemove ? (
        <UndoToast
          message={`"${pendingRemove.exercise_template.name}" will be removed`}
          onUndo={handleUndo}
        />
      ) : null}

      <AppHeader title={presetName || 'Workout'} eyebrow="Workout" />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <TextField
          label="Workout name"
          value={presetName}
          onChangeText={setPresetName}
          onBlur={handleNameBlur}
        />

        <View style={{ gap: spacing.sm }}>
          {visibleExercises.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              expanded={expandedId === exercise.id}
              onToggle={() => setExpandedId(expandedId === exercise.id ? null : exercise.id)}
              onRemove={() => handleRequestRemove(exercise)}
              presetId={presetId}
            />
          ))}
          {visibleExercises.length === 0 ? (
            <View
              style={{
                padding: spacing.xl,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border.subtle,
                borderRadius: radius.md,
                borderStyle: 'dashed',
              }}
            >
              <Text style={[typography.bodySm, { textAlign: 'center' }]}>
                No exercises yet. Tap "Add Exercise" to build your workout.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: spacing.md }}>
          <Button label="Add Exercise" variant="secondary" onPress={() => setShowPicker(true)} />
          <Button
            label="Delete Workout"
            variant="destructive"
            onPress={() => setShowDeleteConfirm(true)}
          />
        </View>
      </View>

      <ExercisePickerSheet
        visible={showPicker}
        presetId={presetId}
        currentCount={exercises.length}
        onClose={() => setShowPicker(false)}
      />

      <ConfirmationSheet
        visible={showDeleteConfirm}
        title="Delete workout?"
        description="This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Screen>
  );
}
