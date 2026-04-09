import type { FoodRow, MealItemRow } from '../types/database';

export type NutritionValues = {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
};

type FoodNutritionFields = Pick<
  FoodRow,
  | 'calories_per_100g'
  | 'protein_per_100g'
  | 'fat_per_100g'
  | 'carbs_per_100g'
  | 'fiber_per_100g'
>;

/**
 * Calculate nutrition values for a given gram amount of a food.
 */
export function calculateNutrition(
  food: FoodNutritionFields,
  amountG: number,
): NutritionValues {
  const factor = amountG / 100;
  return {
    calories: Math.round(food.calories_per_100g * factor * 10) / 10,
    proteinG: Math.round(food.protein_per_100g * factor * 10) / 10,
    fatG: Math.round(food.fat_per_100g * factor * 10) / 10,
    carbsG: Math.round(food.carbs_per_100g * factor * 10) / 10,
    fiberG: Math.round(food.fiber_per_100g * factor * 10) / 10,
  };
}

/**
 * Sum nutrition values across an array of meal items.
 */
export function sumNutrition(items: MealItemRow[]): NutritionValues {
  return items.reduce<NutritionValues>(
    (acc, item) => ({
      calories: Math.round((acc.calories + item.calories) * 10) / 10,
      proteinG: Math.round((acc.proteinG + item.protein_g) * 10) / 10,
      fatG: Math.round((acc.fatG + item.fat_g) * 10) / 10,
      carbsG: Math.round((acc.carbsG + item.carbs_g) * 10) / 10,
      fiberG: Math.round((acc.fiberG + item.fiber_g) * 10) / 10,
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0 },
  );
}

/**
 * Format calories for display: 1847 → "1,847"
 */
export function formatCalories(cal: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(cal),
  );
}

/**
 * Format grams for display: 162.4 → "162g"
 */
export function formatGrams(g: number): string {
  return `${Math.round(g)}g`;
}
