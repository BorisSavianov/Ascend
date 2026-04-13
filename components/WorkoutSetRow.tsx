import React, { memo, useEffect } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fontFamily, motion, radius, spacing, typography } from '../lib/theme';
import type { SetInputState } from '../store/useWorkoutStore';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';

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
  const reducedMotion = useReducedMotionPreference();

  // Animate row background: transparent → surfaceRaised on completion
  const completedProg = useSharedValue(isCompleted ? 1 : 0);
  useEffect(() => {
    completedProg.value = withTiming(isCompleted ? 1 : 0, {
      duration: motion.standard,
    });
  }, [isCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      completedProg.value,
      [0, 1],
      ['transparent', colors.bg.surfaceRaised],
    ),
  }));

  // Animate checkmark icon: scale pulse on completion
  const checkScale = useSharedValue(1);

  function handleToggle() {
    const nowCompleting = !isCompleted;
    if (!reducedMotion && nowCompleting) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      checkScale.value = withSpring(1.25, motion.spring.bouncy, () => {
        checkScale.value = withSpring(1, motion.spring.snappy);
      });
    }
    onToggleComplete();
  }

  const checkIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const prevLabel =
    previousWeightKg != null && previousReps != null
      ? `${previousWeightKg}×${previousReps}`
      : previousReps != null
        ? `—×${previousReps}`
        : '—';

  const repPlaceholder = `${targetRepsMin}–${targetRepsMax}`;

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xs,
          gap: spacing.sm,
        },
        rowStyle,
      ]}
    >
      {/* Set number */}
      <Text
        style={[
          typography.caption,
          {
            width: 28,
            textAlign: 'center',
            color: isCompleted ? colors.text.tertiary : colors.text.disabled,
            fontFamily: fontFamily.monoRegular,
          },
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
            fontFamily: fontFamily.monoRegular,
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
              fontFamily: fontFamily.monoMedium,
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
              color: isCompleted ? colors.semantic.success : colors.text.primary,
              fontFamily: fontFamily.monoMedium,
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
        onPress={handleToggle}
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
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: radius.pill,
              borderWidth: 2,
              borderColor: colors.text.disabled,
              borderTopColor: 'transparent',
            }}
          />
        ) : (
          <Animated.View style={checkIconStyle}>
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isCompleted ? colors.semantic.success : colors.text.disabled}
            />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
});

export default WorkoutSetRow;
