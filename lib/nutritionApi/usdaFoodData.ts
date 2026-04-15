import type { NutritionAPI, NutritionSearchResult } from './types';
import { logger } from '../logger';
import { expandForUSDA } from './synonyms';

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const TIMEOUT_MS = 5_000;
const MAX_RETRIES = 3;

// Confirmed USDA nutrient IDs from USDA FoodData Central API
// Source: https://api.nal.usda.gov/fdc/v1 (live API verified)
const NUTRIENT = {
  CALORIES: 1008,
  PROTEIN:  1003,
  FAT:      1004,
  CARBS:    1005,
  FIBER:    1079,
} as const;

// Flat format used in /foods/search responses
// (different from /food/{id} detail endpoint which uses nested format)
type USDANutrient = { nutrientId: number; value: number };

type USDASearchFood = {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  foodNutrients: USDANutrient[];
};

type USDASearchResponse = { foods: USDASearchFood[]; totalHits: number };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function getNutrient(nutrients: USDANutrient[], id: number): number {
  return nutrients.find(n => n.nutrientId === id)?.value ?? 0;
}

function mapFood(food: USDASearchFood): NutritionSearchResult | null {
  const calories = getNutrient(food.foodNutrients, NUTRIENT.CALORIES);
  if (!calories || !food.description) return null;
  if (calories < 0 || calories > 950) return null;

  return {
    externalId: `usda:${food.fdcId}`,
    name: food.description,
    brand: food.brandOwner?.trim() || undefined,
    imageUrl: undefined,
    caloriesPer100g: round1(calories),
    proteinPer100g:  round1(getNutrient(food.foodNutrients, NUTRIENT.PROTEIN)),
    fatPer100g:      round1(getNutrient(food.foodNutrients, NUTRIENT.FAT)),
    carbsPer100g:    round1(getNutrient(food.foodNutrients, NUTRIENT.CARBS)),
    fiberPer100g:    round1(getNutrient(food.foodNutrients, NUTRIENT.FIBER)),
    source: 'usda',
  };
}

// Pattern copied from openFoodFacts.ts (abortableDelay + withTimeout utilities)
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function withTimeout(callerSignal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const tc = new AbortController();
  const timer = setTimeout(() => tc.abort(), TIMEOUT_MS);
  if (callerSignal) {
    const onAbort = () => tc.abort();
    callerSignal.addEventListener('abort', onAbort, { once: true });
    return { signal: tc.signal, cleanup: () => { clearTimeout(timer); callerSignal.removeEventListener('abort', onAbort); } };
  }
  return { signal: tc.signal, cleanup: () => clearTimeout(timer) };
}

export class USDAFoodDataAPI implements NutritionAPI {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]> {
    if (!this.apiKey) {
      logger.warn('usda_api_key_missing', {});
      return [];
    }

    const expandedQuery = expandForUSDA(query);
    const url = `${BASE_URL}/foods/search?api_key=${this.apiKey}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (attempt > 0) await abortableDelay(Math.min(1000 * 2 ** (attempt - 1), 4000), signal);

      const startTime = Date.now();
      const { signal: fetchSignal, cleanup } = withTimeout(signal);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: expandedQuery,
            dataType: ['Foundation', 'SR Legacy'],
            // Sort ascending puts Foundation (F) before SR Legacy (S) — highest quality first
            sortBy: 'dataType.keyword',
            sortOrder: 'asc',
            pageSize: 25,
          }),
          signal: fetchSignal,
        });

        const latency = Date.now() - startTime;

        if (response.ok) {
          const data = (await response.json()) as USDASearchResponse;
          const results = (data.foods ?? [])
            .map(mapFood)
            .filter((r): r is NutritionSearchResult => r !== null);
          logger.metric('usda_search_latency_ms', latency, { attempt: String(attempt), status: 'ok' });
          return results;
        }

        logger.metric('usda_search_latency_ms', latency, { attempt: String(attempt), status: String(response.status) });

        if (response.status === 429) {
          await abortableDelay(2000, signal);
          lastError = new Error('USDA rate limit exceeded');
          continue;
        }
        if (response.status < 500) {
          throw new Error(`USDA search failed: ${response.status}`);
        }
        lastError = new Error(`USDA search failed: ${response.status}`);
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        lastError = err as Error;
        logger.metric('usda_search_latency_ms', Date.now() - startTime, {
          attempt: String(attempt), status: 'error', error: (err as Error).message,
        });
      } finally {
        cleanup();
      }
    }

    throw lastError ?? new Error('USDA search failed after retries');
  }
}

export const usdaFoodDataAPI = new USDAFoodDataAPI(
  process.env.EXPO_PUBLIC_USDA_API_KEY ?? '',
);
