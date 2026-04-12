import React, { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { SetInputState } from '../store/useWorkoutStore';

type Props = {
  setNumber: number;
  targetRepsMin: number;
  targetRepsMax: number;
  previousWeightKg: number | null;
  previousReps: number | null;
  inputState: SetInputState;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  onToggleComplete: () => void;
};

/**
 * A single set row in the workout exercise card.
 *
 * Layout (horizontal):
 * [Set#:28px] [Prev:68px] [Weight:flex:1] [×:12px] [Reps:52px] [Done:44px]
 */
const WorkoutSetRow = memo(function WorkoutSetRow({
  setNumber,
  targetRepsMin,
  targetRepsMax,
  previousWeightKg,
  previousReps,
  inputState,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
}: Props) {
  const { weight, reps, isCompleted, isSaving } = inputState;

  const prevLabel =
    previousWeightKg != null && previousReps != null
      ? `${previousWeightKg}×${previousReps}`
      : previousReps != null
        ? `—×${previousReps}`
        : '—';

  const repPlaceholder = `${targetRepsMin}–${targetRepsMax}`;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
        backgroundColor: isCompleted
          ? colors.bg.surfaceRaised
          : 'transparent',
        gap: spacing.sm,
      }}
    >
      {/* Set number */}
      <Text
        style={[
          typography.caption,
          { width: 28, textAlign: 'center', color: colors.text.disabled },
        ]}
      >
        {setNumber}
      </Text>

      {/* Previous performance */}
      <Text
        style={[
          typography.caption,
          {
            width: 68,
            textAlign: 'center',
            color: colors.text.tertiary,
            fontVariant: ['tabular-nums'],
          },
        ]}
        numberOfLines={1}
      >
        {prevLabel}
      </Text>

      {/* Weight input */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          height: 36,
          borderRadius: radius.xs,
          borderWidth: 1,
          borderColor: isCompleted ? colors.border.subtle : colors.border.default,
          backgroundColor: colors.bg.input,
          paddingHorizontal: spacing.sm,
          gap: 4,
        }}
      >
        <TextInput
          value={weight}
          onChangeText={onWeightChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.text.disabled}
          style={[
            typography.bodySm,
            {
              flex: 1,
              color: isCompleted ? colors.text.secondary : colors.text.primary,
              fontVariant: ['tabular-nums'],
              textAlign: 'center',
              paddingVertical: 0,
            },
          ]}
          selectTextOnFocus
        />
        <Text style={[typography.caption, { color: colors.text.disabled }]}>
          kg
        </Text>
      </View>

      {/* Separator */}
      <Text style={[typography.caption, { color: colors.text.disabled, width: 8, textAlign: 'center' }]}>
        ×
      </Text>

      {/* Reps input */}
      <View
        style={{
          width: 52,
          height: 36,
          borderRadius: radius.xs,
          borderWidth: 1,
          borderColor: isCompleted ? colors.border.subtle : colors.border.default,
          backgroundColor: colors.bg.input,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xs,
        }}
      >
        <TextInput
          value={reps}
          onChangeText={onRepsChange}
          keyboardType="number-pad"
          placeholder={repPlaceholder}
          placeholderTextColor={colors.text.disabled}
          style={[
            typography.bodySm,
            {
              color: isCompleted ? colors.text.secondary : colors.text.primary,
              fontVariant: ['tabular-nums'],
              textAlign: 'center',
              paddingVertical: 0,
              width: '100%',
            },
          ]}
          selectTextOnFocus
        />
      </View>

      {/* Done toggle */}
      <Pressable
        onPress={onToggleComplete}
        hitSlop={8}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={`Set ${setNumber} ${isCompleted ? 'completed' : 'incomplete'}`}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.text.tertiary} />
        ) : (
          <Ionicons
            name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={
              isCompleted ? colors.semantic.success : colors.text.disabled
            }
          />
        )}
      </Pressable>
    </View>
  );
});

export default WorkoutSetRow;
