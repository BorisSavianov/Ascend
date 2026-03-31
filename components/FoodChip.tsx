import React from 'react';
import { Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DEFAULT_AMOUNT_G } from '../constants/foods';
import { useAppStore, type AppStore, type MealItemDraft } from '../store/useAppStore';
import type { FoodRow } from '../types/database';
import Chip from './ui/Chip';
import { colors, typography } from '../lib/theme';

let _counter = 0;
function nextDraftId(): string {
  _counter += 1;
  return `draft-${Date.now()}-${_counter}`;
}

type Props = {
  food: FoodRow;
};

export default function FoodChip({ food }: Props) {
  const addItem = useAppStore((s: AppStore) => s.addItem);
  const isSelected = useAppStore((s: AppStore) =>
    s.selectedItems.some((i: MealItemDraft) => i.foodId === food.id),
  );
  const existingItem = useAppStore((s: AppStore) =>
    isSelected ? s.selectedItems.find((i: MealItemDraft) => i.foodId === food.id) : undefined,
  );

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (existingItem) {
      addItem({
        id: existingItem.id,
        foodId: food.id,
        foodName: food.name,
        caloriesPer100g: food.calories_per_100g,
        proteinPer100g: food.protein_per_100g,
        fatPer100g: food.fat_per_100g,
        carbsPer100g: food.carbs_per_100g,
        fiberPer100g: food.fiber_per_100g,
        amountG: DEFAULT_AMOUNT_G,
      });
    } else {
      addItem({
        id: nextDraftId(),
        foodId: food.id,
        foodName: food.name,
        caloriesPer100g: food.calories_per_100g,
        proteinPer100g: food.protein_per_100g,
        fatPer100g: food.fat_per_100g,
        carbsPer100g: food.carbs_per_100g,
        fiberPer100g: food.fiber_per_100g,
        amountG: DEFAULT_AMOUNT_G,
      });
    }
  }

  return (
    <Chip
      label={food.name}
      onPress={handlePress}
      selected={isSelected}
      trailing={
        <Text
          style={[
            typography.caption,
            {
              color: isSelected ? colors.text.primary : colors.text.tertiary,
            },
          ]}
        >
          +{DEFAULT_AMOUNT_G}g
        </Text>
      }
    />
  );
}
