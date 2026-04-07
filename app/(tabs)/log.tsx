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
import { useFrequentFoods } from '../../hooks/useFrequentFoods';
import { useLogMeal } from '../../hooks/useLogMeal';
import { formatCalories, calculateNutrition } from '../../lib/calculations';
import { supabase } from '../../lib/supabase';
import { useAppStore, type AppStore, type MealItemDraft } from '../../store/useAppStore';
import type { FoodRow } from '../../types/database';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import TextField from '../../components/ui/TextField';
import SegmentedControl from '../../components/ui/SegmentedControl';
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
  const [searchResults, setSearchResults] = useState<FoodRow[]>([]);
  const [mealIndex, setMealIndex] = useState<1 | 2>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: frequentFoods = [] } = useFrequentFoods();
  const { mutate: logMeal, isPending } = useLogMeal();

  const selectedItems = useAppStore((s: AppStore) => s.selectedItems);
  const updateItemAmount = useAppStore((s: AppStore) => s.updateItemAmount);
  const removeItem = useAppStore((s: AppStore) => s.removeItem);
  const addItem = useAppStore((s: AppStore) => s.addItem);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();

    async function search() {
      const q = debouncedSearch.trim();
      const base = supabase.from('foods').select('*').abortSignal(controller.signal);
      const escapedQ = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const ftsQ = q.replace(/[!|&<>()]/g, ' ').trim();
      const filtered =
        q.length >= 2
          ? base.textSearch('search_vector', ftsQ, { type: 'websearch' })
          : base.ilike('name', `%${escapedQ}%`);
      const { data, error } = await filtered.limit(20);

      if (controller.signal.aborted) return;
      if (error) {
        logger.warn('Search error:', error.message);
      } else {
        setSearchResults(data ?? []);
      }
    }
    void search();
    return () => { controller.abort(); };
  }, [debouncedSearch]);

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

  function handleAddFoodFromSearch(food: FoodRow) {
    const existing = selectedItems.find((i: MealItemDraft) => i.foodId === food.id);
    if (existing) {
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
          setToastMessage('Meal logged');
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  }, [logMeal, mealIndex, selectedItems]);

  const isSearching = searchText.trim().length > 0;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1 }}>
        <AppHeader
          title="Log meal"
          subtitle="Search, tap frequent foods, adjust portions, then commit the entry."
        />

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, flex: 1 }}>
          <SegmentedControl
            options={[
              { label: 'Meal 1', value: 1 as const },
              { label: 'Meal 2', value: 2 as const },
            ]}
            value={mealIndex}
            onChange={setMealIndex}
          />

          <TextField
            ref={searchInputRef}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search foods"
            autoCorrect={false}
            returnKeyType="search"
            label="Food search"
            accessibilityLabel="Search foods"
            accessibilityHint="Type a food name to search the database"
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
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <PressableSearchRow item={item} onPress={() => handleAddFoodFromSearch(item)} />
                  )}
                  ListEmptyComponent={
                    debouncedSearch.trim() ? (
                      <View style={{ padding: spacing.xl }}>
                        <EmptyState
                          title="No foods found"
                          message="Try a broader search term or add one of your frequent foods instead."
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
      <TextButtonRow item={item} onPress={onPress} />
    </View>
  );
}

function TextButtonRow({
  item,
  onPress,
}: {
  item: FoodRow;
  onPress: () => void;
}) {
  return (
    <View>
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
