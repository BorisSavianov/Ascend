import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

export const PRESET_MEAL_LABELS = [
  'Breakfast',
  'Morning Snack',
  'Lunch',
  'Afternoon Snack',
  'Dinner',
  'Evening Snack',
  'Post-workout',
] as const;

type Props = {
  value: string;
  onChange: (label: string) => void;
};

export default function MealLabelSelector({ value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const isPreset = (PRESET_MEAL_LABELS as readonly string[]).includes(value);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={typography.label}>Meal name</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {PRESET_MEAL_LABELS.map((label) => {
          const selected = value === label;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => {
                onChange(label);
                setShowCustom(false);
              }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: selected ? colors.accent.primary : colors.border.subtle,
                backgroundColor: selected ? colors.accent.primaryMuted : 'transparent',
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <Text
                style={[
                  typography.caption,
                  selected && { color: colors.accent.primary },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={() => setShowCustom(true)}
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor:
              showCustom || (!isPreset && value.length > 0)
                ? colors.accent.primary
                : colors.border.subtle,
          }}
          accessibilityRole="button"
          accessibilityLabel="Custom meal name"
        >
          <Text style={typography.caption}>Custom…</Text>
        </TouchableOpacity>
      </ScrollView>

      {showCustom ? (
        <TextInput
          value={!isPreset ? value : ''}
          onChangeText={onChange}
          placeholder="e.g. Pre-workout shake"
          style={[
            typography.body,
            {
              borderWidth: 1,
              borderColor: colors.border.subtle,
              borderRadius: radius.xs,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.text.primary,
            },
          ]}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => setShowCustom(false)}
          accessibilityLabel="Custom meal name input"
        />
      ) : null}
    </View>
  );
}
