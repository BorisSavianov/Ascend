import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { calculateNutrition, formatCalories } from '../lib/calculations';
import type { MealItemDraft } from '../store/useAppStore';

type Props = {
  item: MealItemDraft;
  onAmountChange: (id: string, amountG: number) => void;
  onRemove: (id: string) => void;
};

export default function MealItemRow({ item, onAmountChange, onRemove }: Props) {
  const swipeableRef = useRef<Swipeable>(null);
  // Controlled local state keeps the TextInput in sync when the store updates
  const [amountText, setAmountText] = useState(String(item.amountG));

  // Sync when store updates amount from external sources (e.g. FoodChip increment)
  useEffect(() => {
    setAmountText(String(item.amountG));
  }, [item.amountG]);

  const nutrition = calculateNutrition(
    {
      calories_per_100g: item.caloriesPer100g,
      protein_per_100g: item.proteinPer100g,
      fat_per_100g: item.fatPer100g,
      carbs_per_100g: item.carbsPer100g,
      fiber_per_100g: item.fiberPer100g,
    },
    item.amountG,
  );

  function handleAmountChange(text: string) {
    setAmountText(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      onAmountChange(item.id, parsed);
    }
  }

  function renderRightActions(
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          swipeableRef.current?.close();
          onRemove(item.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.foodName}`}
        className="bg-red-600 justify-center items-center w-20"
      >
        <Animated.Text
          style={{ transform: [{ scale }] }}
          className="text-white font-semibold text-sm"
        >
          Delete
        </Animated.Text>
      </Pressable>
    );
  }

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions}>
      <View className="flex-row items-center bg-gray-900 px-4 py-3 border-b border-gray-800">
        <Text className="flex-1 text-white text-base" numberOfLines={1}>
          {item.foodName}
        </Text>
        <View className="flex-row items-center ml-2">
          <TextInput
            value={amountText}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            className="text-white text-base text-right bg-gray-800 rounded px-2 py-1 w-16"
            selectTextOnFocus
          />
          <Text className="text-gray-400 text-sm ml-1">g</Text>
        </View>
        <Text className="text-gray-300 text-base ml-4 w-16 text-right">
          {formatCalories(nutrition.calories)}
        </Text>
      </View>
    </Swipeable>
  );
}
