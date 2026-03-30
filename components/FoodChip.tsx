import React from 'react';
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DEFAULT_AMOUNT_G } from '../constants/foods';
import { useAppStore, type AppStore, type MealItemDraft } from '../store/useAppStore';
import type { FoodRow } from '../types/database';

// Stable UUID-like key generator for draft items
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
  const existingItem = useAppStore((s: AppStore) =>
    s.selectedItems.find((i: MealItemDraft) => i.foodId === food.id),
  );

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (existingItem) {
      // Increment amount by DEFAULT_AMOUNT_G
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
      const draft: MealItemDraft = {
        id: nextDraftId(),
        foodId: food.id,
        foodName: food.name,
        caloriesPer100g: food.calories_per_100g,
        proteinPer100g: food.protein_per_100g,
        fatPer100g: food.fat_per_100g,
        carbsPer100g: food.carbs_per_100g,
        fiberPer100g: food.fiber_per_100g,
        amountG: DEFAULT_AMOUNT_G,
      };
      addItem(draft);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      className={`rounded-full px-4 py-2 mr-2 border ${
        existingItem
          ? 'bg-green-600 border-green-600'
          : 'bg-gray-800 border-gray-600'
      }`}
    >
      <Text className="text-white text-sm font-medium">{food.name}</Text>
    </Pressable>
  );
}
