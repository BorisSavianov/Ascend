import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { ExerciseRow } from '../types/database';
import { colors, spacing, typography } from '../lib/theme';

type Props = {
  exercise: ExerciseRow;
};

export default function ExerciseRowComponent({ exercise }: Props) {
  const queryClient = useQueryClient();

  function handleDelete() {
    Alert.alert(
      'Delete exercise?',
      `Remove "${exercise.name}" from your log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { void confirmDelete(); } },
      ],
    );
  }

  async function confirmDelete() {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', exercise.id);

    if (error) {
      if (__DEV__) console.warn('Delete exercise error:', error.message);
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const dateStr = format(new Date(exercise.logged_at), 'yyyy-MM-dd');
    void queryClient.invalidateQueries({ queryKey: ['exercises', dateStr] });
    void queryClient.invalidateQueries({ queryKey: ['daily_summaries', dateStr] });
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
