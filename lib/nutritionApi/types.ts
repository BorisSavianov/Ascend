/**
 * externalId prefix conventions (enforce in all provider implementations):
 *   openfoodfacts  →  raw barcode string, e.g. "5060292302101"
 *   usda           →  "usda:{fdcId}",     e.g. "usda:748967"
 *   edamam         →  "edamam:{foodId}",  e.g. "edamam:food_a1gb9ubb72c7snbuxr3weagwfatx"
 */
export type FoodSource = 'openfoodfacts' | 'usda' | 'edamam';

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
  source: FoodSource;
};

export interface NutritionAPI {
  search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]>;
}
