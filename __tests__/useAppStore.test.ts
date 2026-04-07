/**
 * Tests for the Zustand app store's meal-draft mutations.
 * These are pure state transitions — no network or storage involved.
 */

// Mock AsyncStorage so the persist middleware doesn't try to read it
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock constants that pull in complex modules
jest.mock('../constants/notifications', () => ({
  DEFAULT_NOTIFICATION_CONFIG: {},
  DEFAULT_CUSTOM_REMINDERS: [],
  DEFAULT_FASTING_NEAR_END_REMINDER_ENABLED: false,
}));

import { useAppStore } from '../store/useAppStore';
import type { MealItemDraft } from '../store/useAppStore';

const makeItem = (id: string, foodId: string | null = id, amountG = 100): MealItemDraft => ({
  id,
  foodId,
  foodName: `Food ${id}`,
  caloriesPer100g: 100,
  proteinPer100g: 20,
  fatPer100g: 5,
  carbsPer100g: 10,
  fiberPer100g: 2,
  amountG,
});

// Reset store state before each test
beforeEach(() => {
  useAppStore.setState({ selectedItems: [] });
});

describe('addItem', () => {
  it('adds a new item to an empty list', () => {
    const { addItem } = useAppStore.getState();
    addItem(makeItem('a'));
    expect(useAppStore.getState().selectedItems).toHaveLength(1);
    expect(useAppStore.getState().selectedItems[0].id).toBe('a');
  });

  it('adds multiple distinct items', () => {
    const { addItem } = useAppStore.getState();
    addItem(makeItem('a'));
    addItem(makeItem('b', 'b'));
    expect(useAppStore.getState().selectedItems).toHaveLength(2);
  });

  it('accumulates amount when same foodId is added again', () => {
    const { addItem } = useAppStore.getState();
    addItem(makeItem('a', 'food-1', 100));
    addItem(makeItem('b', 'food-1', 50));
    const items = useAppStore.getState().selectedItems;
    expect(items).toHaveLength(1);
    expect(items[0].amountG).toBe(150);
  });

  it('does NOT accumulate for null foodId (custom items)', () => {
    const { addItem } = useAppStore.getState();
    addItem(makeItem('a', null, 100));
    addItem(makeItem('b', null, 100));
    expect(useAppStore.getState().selectedItems).toHaveLength(2);
  });
});

describe('updateItemAmount', () => {
  it('updates the amount of an existing item', () => {
    const { addItem, updateItemAmount } = useAppStore.getState();
    addItem(makeItem('a', 'food-1', 100));
    updateItemAmount('a', 250);
    expect(useAppStore.getState().selectedItems[0].amountG).toBe(250);
  });

  it('does not affect other items', () => {
    const { addItem, updateItemAmount } = useAppStore.getState();
    addItem(makeItem('a', 'food-1', 100));
    addItem(makeItem('b', 'food-2', 100));
    updateItemAmount('a', 200);
    const items = useAppStore.getState().selectedItems;
    expect(items.find((i) => i.id === 'b')?.amountG).toBe(100);
  });
});

describe('removeItem', () => {
  it('removes the item with matching id', () => {
    const { addItem, removeItem } = useAppStore.getState();
    addItem(makeItem('a'));
    addItem(makeItem('b', 'b'));
    removeItem('a');
    const items = useAppStore.getState().selectedItems;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('b');
  });

  it('is a no-op for unknown id', () => {
    const { addItem, removeItem } = useAppStore.getState();
    addItem(makeItem('a'));
    removeItem('nonexistent');
    expect(useAppStore.getState().selectedItems).toHaveLength(1);
  });
});

describe('clearItems', () => {
  it('empties the selected items list', () => {
    const { addItem, clearItems } = useAppStore.getState();
    addItem(makeItem('a'));
    addItem(makeItem('b', 'b'));
    clearItems();
    expect(useAppStore.getState().selectedItems).toHaveLength(0);
  });
});

describe('settings', () => {
  it('updates calorieTarget', () => {
    useAppStore.getState().setCalorieTarget(2500);
    expect(useAppStore.getState().calorieTarget).toBe(2500);
  });

  it('updates fastingTargetHours', () => {
    useAppStore.getState().setFastingTargetHours(18);
    expect(useAppStore.getState().fastingTargetHours).toBe(18);
  });

  it('updates macroTargets', () => {
    useAppStore.getState().setMacroTargets({ protein: 200, fat: 60, carbs: 150 });
    const t = useAppStore.getState().macroTargets;
    expect(t.protein).toBe(200);
    expect(t.fat).toBe(60);
    expect(t.carbs).toBe(150);
  });
});
