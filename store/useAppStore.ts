import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CustomReminder, NotificationConfig } from '../constants/notifications';
import {
  DEFAULT_CUSTOM_REMINDERS,
  DEFAULT_FASTING_NEAR_END_REMINDER_ENABLED,
  DEFAULT_NOTIFICATION_CONFIG,
} from '../constants/notifications';

export type MealItemDraft = {
  /** Local UUID used as list key — not the DB id */
  id: string;
  foodId: string | null;
  foodName: string;
  /** Nutrition per 100g — used to compute live totals */
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number;
  /** Current amount in grams */
  amountG: number;
};

export type MacroTargets = {
  protein: number;
  fat: number;
  carbs: number;
};

export type AppStore = {
  // ── Meal logging (ephemeral, not persisted) ──────────────────────────────
  selectedItems: MealItemDraft[];
  addItem: (item: MealItemDraft) => void;
  updateItemAmount: (id: string, amountG: number) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  mealLabel: string;
  setMealLabel: (label: string) => void;

  // ── Settings (persisted to AsyncStorage) ─────────────────────────────────
  calorieTarget: number;
  macroTargets: MacroTargets;
  notificationConfig: NotificationConfig;
  customReminders: CustomReminder[];
  fastingTargetHours: number;
  fastingNearEndReminderEnabled: boolean;

  setCalorieTarget: (kcal: number) => void;
  setMacroTargets: (targets: MacroTargets) => void;
  setNotificationConfig: (config: NotificationConfig) => void;
  setCustomReminders: (reminders: CustomReminder[]) => void;
  setFastingTargetHours: (hours: number) => void;
  setFastingNearEndReminderEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
};

type PersistedSettings = {
  calorieTarget: number;
  macroTargets: MacroTargets;
  notificationConfig: NotificationConfig;
  customReminders: CustomReminder[];
  fastingTargetHours: number;
  fastingNearEndReminderEnabled: boolean;
};

export const useAppStore = create<AppStore>()(
  persist<AppStore, PersistedSettings>(
    (set) => ({
      // ── Meal logging ─────────────────────────────────────────────────────
      selectedItems: [],

      addItem: (item: MealItemDraft) =>
        set((state) => {
          const existing = state.selectedItems.find(
            (i) => i.foodId !== null && i.foodId === item.foodId,
          );
          if (existing) {
            return {
              selectedItems: state.selectedItems.map((i) =>
                i.id === existing.id
                  ? { ...i, amountG: i.amountG + item.amountG }
                  : i,
              ),
            };
          }
          return { selectedItems: [...state.selectedItems, item] };
        }),

      updateItemAmount: (id: string, amountG: number) =>
        set((state) => ({
          selectedItems: state.selectedItems.map((i) =>
            i.id === id ? { ...i, amountG } : i,
          ),
        })),

      removeItem: (id: string) =>
        set((state) => ({
          selectedItems: state.selectedItems.filter((i) => i.id !== id),
        })),

      clearItems: () => set({ selectedItems: [], mealLabel: '' }),
      mealLabel: '',
      setMealLabel: (label: string) => set({ mealLabel: label }),

      // ── Settings ─────────────────────────────────────────────────────────
      calorieTarget: 2000,
      macroTargets: { protein: 160, fat: 80, carbs: 100 },
      notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
      customReminders: DEFAULT_CUSTOM_REMINDERS,
      fastingTargetHours: 16,
      fastingNearEndReminderEnabled: DEFAULT_FASTING_NEAR_END_REMINDER_ENABLED,

      setCalorieTarget: (kcal: number) => set({ calorieTarget: kcal }),
      setMacroTargets: (targets: MacroTargets) => set({ macroTargets: targets }),
      setNotificationConfig: (config: NotificationConfig) =>
        set({ notificationConfig: config }),
      setCustomReminders: (reminders: CustomReminder[]) => set({ customReminders: reminders }),
      setFastingTargetHours: (hours: number) => set({ fastingTargetHours: hours }),
      setFastingNearEndReminderEnabled: (enabled: boolean) =>
        set({ fastingNearEndReminderEnabled: enabled }),
      resetSettings: () =>
        set({
          calorieTarget: 2000,
          macroTargets: { protein: 160, fat: 80, carbs: 100 },
          notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
          customReminders: DEFAULT_CUSTOM_REMINDERS,
          fastingTargetHours: 16,
          fastingNearEndReminderEnabled: DEFAULT_FASTING_NEAR_END_REMINDER_ENABLED,
        }),
    }),
    {
      name: '@app_settings',
      storage: createJSONStorage<PersistedSettings>(
        () => AsyncStorage as unknown as Storage,
      ),
      partialize: (state): PersistedSettings => ({
      calorieTarget: state.calorieTarget,
      macroTargets: state.macroTargets,
      notificationConfig: state.notificationConfig,
      customReminders: state.customReminders,
      fastingTargetHours: state.fastingTargetHours,
      fastingNearEndReminderEnabled: state.fastingNearEndReminderEnabled,
    }),
    },
  ),
);
