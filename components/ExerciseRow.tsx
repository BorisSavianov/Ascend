import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { ExerciseRow } from '../types/database';

type Props = {
  exercise: ExerciseRow;
};

export default function ExerciseRowComponent({ exercise }: Props) {
  const queryClient = useQueryClient();

  async function handleDelete() {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', exercise.id);

    if (error) {
      if (__DEV__) console.warn('Delete exercise error:', error.message);
      return;
    }

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
      <Pressable onPress={handleDelete} hitSlop={8}>
        <Text className="text-gray-500 text-lg">✕</Text>
      </Pressable>
    </View>
  );
}
