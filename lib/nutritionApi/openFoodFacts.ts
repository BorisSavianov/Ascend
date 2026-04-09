import type { NutritionAPI, NutritionSearchResult } from './types';

const BASE_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

type OFFNutriments = {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
  fiber_100g?: number;
};

type OFFProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: OFFNutriments;
};

type OFFSearchResponse = {
  products: OFFProduct[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mapProduct(p: OFFProduct): NutritionSearchResult | null {
  const name = p.product_name?.trim();
  const calories = p.nutriments?.['energy-kcal_100g'];
  if (!name || calories == null || !p.code) return null;

  return {
    externalId: p.code,
    name,
    brand: p.brands?.trim() || undefined,
    caloriesPer100g: round1(calories),
    proteinPer100g: round1(p.nutriments?.proteins_100g ?? 0),
    fatPer100g: round1(p.nutriments?.fat_100g ?? 0),
    carbsPer100g: round1(p.nutriments?.carbohydrates_100g ?? 0),
    fiberPer100g: round1(p.nutriments?.fiber_100g ?? 0),
    source: 'openfoodfacts',
  };
}

const MAX_RETRIES = 3;
const USER_AGENT = 'AscendTracker/1.0 (https://github.com/BorisSavianov/Ascend)';

export class OpenFoodFactsAPI implements NutritionAPI {
  async search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]> {
    const params = new URLSearchParams({
      action: 'process',
      json: '1',
      search_terms: query,
      fields: 'code,product_name,brands,nutriments',
      page_size: '10',
      sort_by: 'popularity_key',
    });

    const url = `${BASE_URL}?${params}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s…
        const delay = Math.min(1000 * 2 ** (attempt - 1), 4000);
        await new Promise((r) => setTimeout(r, delay));
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      }

      try {
        const response = await fetch(url, {
          signal,
          headers: { 'User-Agent': USER_AGENT },
        });

        if (response.ok) {
          const data = (await response.json()) as OFFSearchResponse;
          return data.products
            .map(mapProduct)
            .filter((r): r is NutritionSearchResult => r !== null);
        }

        // Retry on server errors (5xx), throw on client errors (4xx)
        if (response.status < 500) {
          throw new Error(`OpenFoodFacts search failed: ${response.status}`);
        }
        lastError = new Error(`OpenFoodFacts search failed: ${response.status}`);
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        lastError = err as Error;
        // Retry on network errors
      }
    }

    throw lastError ?? new Error('OpenFoodFacts search failed after retries');
  }
}

export const openFoodFactsAPI = new OpenFoodFactsAPI();
