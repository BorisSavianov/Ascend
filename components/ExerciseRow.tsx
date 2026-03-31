import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { ExerciseRow } from '../types/database';

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
    <View className="flex-row items-center bg-gray-900 px-4 py-3 border-b border-gray-800">
      <View className="flex-1">
        <Text className="text-white text-base">{exercise.name}</Text>
        <Text className="text-gray-400 text-xs mt-0.5">
          {exercise.duration_min != null ? `${exercise.duration_min} min` : ''}
        </Text>
      </View>
      <Text className="text-orange-400 font-semibold text-base mr-4">
        −{exercise.calories_burned ?? 0} kcal
      </Text>
      <Pressable
        onPress={handleDelete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${exercise.name}`}
        style={{ padding: 6 }}
      >
        <Text className="text-gray-500 text-lg">✕</Text>
      </Pressable>
    </View>
  );
}
