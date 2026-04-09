import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import * as Haptics from 'expo-haptics';
import {
  FlatList,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import FoodChip from '../../components/FoodChip';
import MealItemRow from '../../components/MealItemRow';
import MealLabelSelector from '../../components/MealLabelSelector';
import { useFrequentFoods } from '../../hooks/useFrequentFoods';
import { useLogMeal } from '../../hooks/useLogMeal';
import { useTodayMeals } from '../../hooks/useTodayMeals';
import { useFoodSearch, cacheApiFood } from '../../hooks/useFoodSearch';
import type { NutritionSearchResult } from '../../hooks/useFoodSearch';
import { formatCalories, calculateNutrition } from '../../lib/calculations';
import { useAppStore, type AppStore, type MealItemDraft } from '../../store/useAppStore';
import type { FoodRow } from '../../types/database';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import TextField from '../../components/ui/TextField';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import BottomActionBar from '../../components/ui/BottomActionBar';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/ui/Toast';
import { colors, spacing, typography } from '../../lib/theme';
import { logger } from '../../lib/logger';

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: frequentFoods = [] } = useFrequentFoods();
  const { data: todayMeals = [] } = useTodayMeals();
  const { mutate: logMeal, isPending } = useLogMeal();

  const selectedItems = useAppStore((s: AppStore) => s.selectedItems);
  const mealLabel = useAppStore((s: AppStore) => s.mealLabel);
  const updateItemAmount = useAppStore((s: AppStore) => s.updateItemAmount);
  const removeItem = useAppStore((s: AppStore) => s.removeItem);
  const addItem = useAppStore((s: AppStore) => s.addItem);
  const setMealLabel = useAppStore((s: AppStore) => s.setMealLabel);

  const { localResults, apiResults, isSearchingApi } = useFoodSearch(debouncedSearch);

  // Sort order = next available slot (existing meals + 1)
  const sortOrder = todayMeals.length + 1;

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Debounce: 300ms to be gentle on the API
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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

  function addFoodRow(food: FoodRow) {
    const existing = selectedItems.find((i: MealItemDraft) => i.foodId === food.id);
    if (existing) {
      addItem({ ...existing, amountG: 100 });
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
        amountG: 100,
      });
    }
  }

  async function handleAddApiFood(result: NutritionSearchResult) {
    try {
      const food = await cacheApiFood(result);
      addFoodRow(food);
    } catch (err) {
      logger.warn('Failed to cache API food:', String(err));
      // Add as an anonymous draft without a DB foodId (graceful fallback)
      addItem({
        id: nextDraftId(),
        foodId: null,
        foodName: result.name,
        caloriesPer100g: result.caloriesPer100g,
        proteinPer100g: result.proteinPer100g,
        fatPer100g: result.fatPer100g,
        carbsPer100g: result.carbsPer100g,
        fiberPer100g: result.fiberPer100g,
        amountG: 100,
      });
    }
  }

  const handleLog = useCallback(() => {
    if (selectedItems.length === 0) return;
    const label = mealLabel.trim() || `Meal ${sortOrder}`;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logMeal(
      { sortOrder, mealLabel: label, items: selectedItems },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setToastMessage('Meal logged');
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  }, [logMeal, mealLabel, sortOrder, selectedItems]);

  const isSearching = searchText.trim().length > 0;

  type SearchItem =
    | { type: 'local'; food: FoodRow }
    | { type: 'api'; result: NutritionSearchResult };

  const searchData: SearchItem[] = [
    ...localResults.map((f): SearchItem => ({ type: 'local', food: f })),
    ...apiResults.map((r): SearchItem => ({ type: 'api', result: r })),
  ];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1 }}>
        <AppHeader
          title="Log meal"
          subtitle="Name your meal, search for foods, adjust portions, then commit."
        />

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, flex: 1 }}>
          <MealLabelSelector value={mealLabel} onChange={setMealLabel} />

          <TextField
            ref={searchInputRef}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search foods"
            autoCorrect={false}
            returnKeyType="search"
            label="Food search"
            accessibilityLabel="Search foods"
            accessibilityHint="Type a food name to search your foods and the Open Food Facts database"
          />

          {!isSearching && frequentFoods.length > 0 ? (
            <View>
              <Text style={typography.label}>Frequent foods</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingTop: spacing.md,
                  paddingBottom: spacing.sm,
                  gap: spacing.sm,
                }}
              >
                {frequentFoods.map((food) => (
                  <FoodChip key={food.id} food={food} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ flex: 1 }}>
            {isSearching ? (
              <Surface style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
                <FlatList
                  data={searchData}
                  keyExtractor={(item) =>
                    item.type === 'local' ? item.food.id : `api-${item.result.externalId}`
                  }
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) =>
                    item.type === 'local' ? (
                      <PressableSearchRow
                        item={item.food}
                        onPress={() => addFoodRow(item.food)}
                      />
                    ) : (
                      <ApiSearchRow
                        result={item.result}
                        onPress={() => void handleAddApiFood(item.result)}
                      />
                    )
                  }
                  ListHeaderComponent={
                    isSearchingApi ? (
                      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
                        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                          Searching Open Food Facts…
                        </Text>
                      </View>
                    ) : null
                  }
                  ListEmptyComponent={
                    debouncedSearch.trim() && !isSearchingApi ? (
                      <View style={{ padding: spacing.xl }}>
                        <EmptyState
                          title="No foods found"
                          message="Try a broader search term or add a frequent food instead."
                        />
                      </View>
                    ) : null
                  }
                />
              </Surface>
            ) : selectedItems.length > 0 ? (
              <Surface style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
                <FlatList
                  data={selectedItems}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <MealItemRow
                      item={item}
                      onAmountChange={updateItemAmount}
                      onRemove={removeItem}
                    />
                  )}
                />
              </Surface>
            ) : (
              <EmptyState
                title="Start building a meal"
                message="Search for foods or tap a frequent item to build a meal before logging it."
              />
            )}
          </View>
        </View>

        <BottomActionBar>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View>
              <Text style={typography.caption}>Current total</Text>
              <Text
                style={[
                  typography.h3,
                  {
                    marginTop: spacing.xs,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {formatCalories(totalCalories)} kcal
              </Text>
            </View>
            <Text style={typography.caption}>
              {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Button
            label="Log meal"
            onPress={handleLog}
            disabled={selectedItems.length === 0}
            loading={isPending}
          />
        </BottomActionBar>

        {toastMessage ? <Toast message={toastMessage} tone="success" /> : null}
      </View>
    </Screen>
  );
}

function PressableSearchRow({
  item,
  onPress,
}: {
  item: FoodRow;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 64,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={typography.body}>{item.name}</Text>
          {item.name_local ? (
            <Text style={[typography.caption, { marginTop: spacing.xs }]}>
              {item.name_local}
            </Text>
          ) : null}
        </View>
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {item.calories_per_100g} kcal/100g
        </Text>
        <Button
          label="Add"
          onPress={onPress}
          size="md"
          leading={<Ionicons name="add" size={14} color={colors.bg.canvas} />}
          style={{ minWidth: 88 }}
        />
      </View>
    </View>
  );
}

function ApiSearchRow({
  result,
  onPress,
}: {
  result: NutritionSearchResult;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 64,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={typography.body}>{result.name}</Text>
          {result.brand ? (
            <Text style={[typography.caption, { marginTop: spacing.xs }]}>
              {result.brand}
            </Text>
          ) : null}
        </View>
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {result.caloriesPer100g} kcal/100g
        </Text>
        <Button
          label="Add"
          onPress={onPress}
          size="md"
          leading={<Ionicons name="add" size={14} color={colors.bg.canvas} />}
          style={{ minWidth: 88 }}
        />
      </View>
    </View>
  );
}
