export type NutritionSearchResult = {
  externalId: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number;
  source: 'openfoodfacts';
};

export interface NutritionAPI {
  search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]>;
}
