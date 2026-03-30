import React, { useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import ExerciseRowComponent from '../../components/ExerciseRow';
import { useExercises } from '../../hooks/useExercises';
import { useLogExercise } from '../../hooks/useLogExercise';
import { useDailySummary } from '../../hooks/useDailySummary';
import { EXERCISE_PRESETS } from '../../constants/exercises';

type Preset = (typeof EXERCISE_PRESETS)[number];

export default function MoveScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load move screen">
      <MoveScreenContent />
    </ErrorBoundary>
  );
}

function MoveScreenContent() {
  const today = new Date();

  const { data: exercises = [] } = useExercises(today);
  const { data: summary } = useDailySummary(today);
  const { mutate: logExercise, isPending } = useLogExercise();

  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [name, setName] = useState('');
  const [durationText, setDurationText] = useState('');
  const [caloriesText, setCaloriesText] = useState('');

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
      {
        name: name.trim(),
        category: selectedPreset?.category,
        durationMin: dur,
        caloriesBurned: cal,
      },
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

  const totalFoodCalories = summary?.total_calories ?? 0;
  const totalExerciseCalories = exercises.reduce(
    (sum, e) => sum + (e.calories_burned ?? 0),
    0,
  );
  const netCalories = totalFoodCalories - totalExerciseCalories;

  const canLog =
    name.trim().length > 0 &&
    parseInt(durationText, 10) > 0 &&
    parseInt(caloriesText, 10) >= 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-white text-2xl font-bold">Move</Text>
          <Text className="text-gray-400 text-sm mt-0.5">
            {format(today, 'EEEE, d MMMM')}
          </Text>
        </View>

        {/* Preset chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="py-2"
        >
          {EXERCISE_PRESETS.map((preset) => (
            <Pressable
              key={preset.name}
              onPress={() => handleSelectPreset(preset)}
              className={`rounded-full px-4 py-2 mr-2 border ${
                selectedPreset?.name === preset.name
                  ? 'bg-orange-500 border-orange-500'
                  : 'bg-gray-800 border-gray-600'
              }`}
            >
              <Text className="text-white text-sm font-medium">{preset.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Form */}
        <View className="mx-4 mt-2 bg-gray-900 rounded-2xl p-4">
          <View className="mb-3">
            <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">
              Exercise
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Walking"
              placeholderTextColor="#6b7280"
              className="bg-gray-800 text-white rounded-xl px-4 py-3 text-base"
              returnKeyType="next"
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                Duration (min)
              </Text>
              <TextInput
                value={durationText}
                onChangeText={handleDurationChange}
                placeholder="30"
                placeholderTextColor="#6b7280"
                keyboardType="number-pad"
                className="bg-gray-800 text-white rounded-xl px-4 py-3 text-base"
              />
            </View>
            <View className="flex-1">
              <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                Calories burned
              </Text>
              <TextInput
                value={caloriesText}
                onChangeText={setCaloriesText}
                placeholder="0"
                placeholderTextColor="#6b7280"
                keyboardType="number-pad"
                className="bg-gray-800 text-white rounded-xl px-4 py-3 text-base"
              />
            </View>
          </View>

          <Pressable
            onPress={handleLog}
            disabled={!canLog || isPending}
            className={`mt-4 rounded-xl py-4 items-center ${
              !canLog || isPending ? 'bg-gray-700' : 'bg-orange-500'
            }`}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">LOG EXERCISE</Text>
            )}
          </Pressable>
        </View>

        {/* Today's exercises */}
        {exercises.length > 0 ? (
          <View className="mx-4 mt-4">
            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-2">
              Today
            </Text>
            {exercises.map((exercise) => (
              <ExerciseRowComponent key={exercise.id} exercise={exercise} />
            ))}
          </View>
        ) : null}

        {/* Net calories note */}
        <View className="mx-4 mt-4 mb-8 bg-gray-900 rounded-2xl px-4 py-3">
          <Text className="text-gray-400 text-sm text-center">
            Net today:{' '}
            <Text className="text-white font-semibold">
              {Math.round(totalFoodCalories)}
            </Text>
            <Text className="text-gray-400"> food</Text>
            {totalExerciseCalories > 0 ? (
              <>
                <Text className="text-gray-400"> − </Text>
                <Text className="text-orange-400 font-semibold">
                  {Math.round(totalExerciseCalories)}
                </Text>
                <Text className="text-gray-400"> exercise = </Text>
                <Text className="text-white font-bold">
                  {Math.round(netCalories)} kcal
                </Text>
              </>
            ) : null}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
