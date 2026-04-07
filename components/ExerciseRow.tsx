import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ExerciseRow } from '../types/database';
import { colors, spacing, typography } from '../lib/theme';

type Props = {
  exercise: ExerciseRow;
  onRequestDelete: (exercise: ExerciseRow) => void;
};

export default function ExerciseRowComponent({ exercise, onRequestDelete }: Props) {
  function handleDelete() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRequestDelete(exercise);
  }

  return (
    <View
      style={{
        minHeight: 64,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.bg.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.accent.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="barbell-outline" size={18} color={colors.accent.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.body}>{exercise.name}</Text>
        <Text style={[typography.caption, { marginTop: spacing.xs }]}>
          {exercise.duration_min != null ? `${exercise.duration_min} min` : 'Logged activity'}
        </Text>
      </View>
      <Text
        style={[
          typography.label,
          {
            color: colors.semantic.warning,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        -{exercise.calories_burned ?? 0} kcal
      </Text>
      <Pressable
        onPress={handleDelete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${exercise.name}`}
        style={{ padding: 4 }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.text.tertiary} />
      </Pressable>
    </View>
  );
}
