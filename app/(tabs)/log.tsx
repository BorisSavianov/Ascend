import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import * as Haptics from 'expo-haptics';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FoodChip from '../../components/FoodChip';
import MealItemRow from '../../components/MealItemRow';
import { useFrequentFoods } from '../../hooks/useFrequentFoods';
import { useLogMeal } from '../../hooks/useLogMeal';
import { getMealIndexFromTime, formatCalories, calculateNutrition } from '../../lib/calculations';
import { supabase } from '../../lib/supabase';
import { useAppStore, type AppStore, type MealItemDraft } from '../../store/useAppStore';
import type { FoodRow } from '../../types/database';

let _draftCounter = 0;
function nextDraftId(): string {
  _draftCounter += 1;
  return `draft-log-${Date.now()}-${_draftCounter}`;
}

export default function LogScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load log screen">
      <LogScreenContent />
    </ErrorBoundary>
  );
}

function LogScreenContent() {
  const searchInputRef = useRef<TextInput>(null);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FoodRow[]>([]);
  const [mealIndex, setMealIndex] = useState<1 | 2>(getMealIndexFromTime());

  const { data: frequentFoods } = useFrequentFoods();
  const { mutate: logMeal, isPending } = useLogMeal();

  const selectedItems = useAppStore((s: AppStore) => s.selectedItems);
  const updateItemAmount = useAppStore((s: AppStore) => s.updateItemAmount);
  const removeItem = useAppStore((s: AppStore) => s.removeItem);
  const addItem = useAppStore((s: AppStore) => s.addItem);

  // Auto-focus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Debounce search input 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch search results when debouncedSearch changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    async function search() {
      const q = debouncedSearch.trim();
      // Full-text search via GIN index (covers both name and name_local).
      // Fall back to ilike for single-char queries where websearch needs at least 2 chars.
      const base = supabase.from('foods').select('*');
      const filtered =
        q.length >= 2
          ? base.textSearch('search_vector', q, { type: 'websearch' })
          : base.ilike('name', `%${q}%`);
      const { data, error } = await filtered.limit(20);

      if (!cancelled) {
        if (error) {
          if (__DEV__) console.warn('Search error:', error.message);
        } else {
          setSearchResults(data ?? []);
        }
      }
    }
    void search();
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const totalCalories = selectedItems.reduce((sum: number, item: MealItemDraft) => {
    const { calories } = calculateNutrition(
      {
        calories_per_100g: item.caloriesPer100g,
        protein_per_100g: item.proteinPer100g,
        fat_per_100g: item.fatPer100g,
        carbs_per_100g: item.carbsPer100g,
        fiber_per_100g: item.fiberPer100g,
      },
      item.amountG,
    );
    return sum + calories;
  }, 0);

  function handleMealLabelPress() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Meal 1', 'Meal 2'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) setMealIndex(1);
          if (buttonIndex === 2) setMealIndex(2);
        },
      );
    } else {
      Alert.alert('Select meal', undefined, [
        { text: 'Meal 1', onPress: () => setMealIndex(1) },
        { text: 'Meal 2', onPress: () => setMealIndex(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function handleAddFoodFromSearch(food: FoodRow) {
    const existing = selectedItems.find((i: MealItemDraft) => i.foodId === food.id);
    if (existing) {
      // Increment by 100g
      addItem({
        id: existing.id,
        foodId: food.id,
        foodName: food.name,
        caloriesPer100g: food.calories_per_100g,
        proteinPer100g: food.protein_per_100g,
        fatPer100g: food.fat_per_100g,
        carbsPer100g: food.carbs_per_100g,
        fiberPer100g: food.fiber_per_100g,
        amountG: 100,
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
        amountG: 100,
      };
      addItem(draft);
    }
  }

  const handleLog = useCallback(() => {
    if (selectedItems.length === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logMeal(
      { mealIndex, items: selectedItems },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  }, [logMeal, mealIndex, selectedItems]);

  const isSearching = searchText.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <View className="flex-1">
          {/* Header row — meal label */}
          <View className="flex-row items-center px-4 pt-4 pb-2">
            <Pressable onPress={handleMealLabelPress} className="flex-row items-center">
              <Text className="text-white text-2xl font-bold">
                Meal {mealIndex}
              </Text>
              <Text className="text-gray-400 text-lg ml-2">▾</Text>
            </Pressable>
          </View>

          {/* Search input */}
          <View className="px-4 pb-2">
            <TextInput
              ref={searchInputRef}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search foods..."
              placeholderTextColor="#6b7280"
              className="bg-gray-800 text-white rounded-xl px-4 py-3 text-base"
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>

          {/* Frequent foods grid — shown when not searching */}
          {!isSearching && frequentFoods.length > 0 ? (
            <View className="pb-2">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                className="py-1"
              >
                {frequentFoods.map((food) => (
                  <FoodChip key={food.id} food={food} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Search results — shown when searching */}
          {isSearching ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleAddFoodFromSearch(item)}
                  className="flex-row items-center px-4 py-3 border-b border-gray-800"
                >
                  <View className="flex-1">
                    <Text className="text-white text-base">{item.name}</Text>
                    {item.name_local ? (
                      <Text className="text-gray-500 text-xs">{item.name_local}</Text>
                    ) : null}
                  </View>
                  <Text className="text-gray-400 text-sm mr-3">
                    {item.calories_per_100g} kcal/100g
                  </Text>
                  <Text className="text-green-500 text-xl font-bold">+</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                debouncedSearch.trim() ? (
                  <View className="px-4 py-8 items-center">
                    <Text className="text-gray-500 text-sm">No foods found</Text>
                  </View>
                ) : null
              }
            />
          ) : null}

          {/* Selected items list */}
          {!isSearching && selectedItems.length > 0 ? (
            <FlatList
              data={selectedItems}
              keyExtractor={(item) => item.id}
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <MealItemRow
                  item={item}
                  onAmountChange={updateItemAmount}
                  onRemove={removeItem}
                />
              )}
            />
          ) : null}

          {/* Spacer when nothing shown */}
          {!isSearching && selectedItems.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-600 text-sm">
                Search or tap a food to add it
              </Text>
            </View>
          ) : null}

          {/* Total bar + LOG MEAL button — pinned at bottom */}
          <View className="border-t border-gray-800 bg-gray-950 px-4 py-3">
            {selectedItems.length > 0 ? (
              <Text className="text-gray-400 text-sm text-center mb-2">
                Total:{' '}
                <Text className="text-white font-semibold">
                  {formatCalories(totalCalories)} kcal
                </Text>
              </Text>
            ) : null}
            <Pressable
              onPress={handleLog}
              disabled={selectedItems.length === 0 || isPending}
              className={`rounded-xl py-4 items-center ${
                selectedItems.length === 0 || isPending
                  ? 'bg-gray-700'
                  : 'bg-green-600'
              }`}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">LOG MEAL</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
