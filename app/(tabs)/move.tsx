import React, { useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ScrollView,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import ExerciseRowComponent from '../../components/ExerciseRow';
import { useExercises } from '../../hooks/useExercises';
import { useLogExercise } from '../../hooks/useLogExercise';
import { useDailySummary } from '../../hooks/useDailySummary';
import { EXERCISE_PRESETS } from '../../constants/exercises';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Chip from '../../components/ui/Chip';
import Surface from '../../components/ui/Surface';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import { colors, spacing, typography } from '../../lib/theme';

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
    <Screen scroll contentContainerStyle={{ paddingBottom: 132 }}>
      <AppHeader
        title="Move"
        eyebrow={format(today, 'EEEE, d MMMM')}
        subtitle="Keep the exercise flow as quick as meal logging, with clearer presets and cleaner totals."
      />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>
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

        <Surface>
          <Text style={typography.h3}>Net energy today</Text>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              marginTop: spacing.lg,
            }}
          >
            <SummaryCard label="Food" value={`${Math.round(totalFoodCalories)}`} />
            <SummaryCard label="Exercise" value={`${Math.round(totalExerciseCalories)}`} tint={colors.semantic.warning} />
            <SummaryCard label="Net" value={`${Math.round(netCalories)}`} tint={colors.accent.primary} />
          </View>
        </Surface>

        {exercises.length > 0 ? (
          <Surface style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <Text style={typography.h3}>Today’s activity</Text>
              <Text style={[typography.caption, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
                Logged movement contributing to your daily net calories.
              </Text>
            </View>
            {exercises.map((exercise) => (
              <ExerciseRowComponent key={exercise.id} exercise={exercise} />
            ))}
          </Surface>
        ) : (
          <Surface>
            <Text style={typography.h3}>No exercise logged yet</Text>
            <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
              Use a preset or type an activity to start building your movement log.
            </Text>
          </Surface>
        )}
      </View>
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
          {
            color: tint,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
