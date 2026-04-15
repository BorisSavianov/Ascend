import type { NutritionAPI, NutritionSearchResult } from './types';
import { logger } from '../logger';

const BASE_URL = 'https://api.edamam.com/api/food-database/v2';
const TIMEOUT_MS = 5_000;

// Edamam nutrient codes (Atwater-style, per 100g)
// Source: https://developer.edamam.com/food-database-api-docs
type EdamamNutrients = {
  ENERC_KCAL?: number;  // Energy (kcal)
  PROCNT?: number;       // Protein (g)
  FAT?: number;          // Total fat (g)
  CHOCDF?: number;       // Carbohydrates (g)
  FIBTG?: number;        // Dietary fiber (g)
};

type EdamamFood = {
  foodId: string;
  label: string;
  brand?: string;
  image?: string;
  nutrients: EdamamNutrients;
};

type EdamamParserResponse = {
  parsed: Array<{ food: EdamamFood }>;
  hints: Array<{ food: EdamamFood }>;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

function mapFood(food: EdamamFood): NutritionSearchResult | null {
  const calories = food.nutrients.ENERC_KCAL;
  if (!calories || !food.label || !food.foodId) return null;
  if (calories < 0 || calories > 950) return null;

  return {
    externalId: `edamam:${food.foodId}`,
    name: food.label,
    brand: food.brand?.trim() || undefined,
    imageUrl: food.image?.trim() || undefined,
    caloriesPer100g: round1(calories),
    proteinPer100g:  round1(food.nutrients.PROCNT ?? 0),
    fatPer100g:      round1(food.nutrients.FAT ?? 0),
    carbsPer100g:    round1(food.nutrients.CHOCDF ?? 0),
    fiberPer100g:    round1(food.nutrients.FIBTG ?? 0),
    source: 'edamam',
  };
}

export class EdamamAPI implements NutritionAPI {
  private readonly appId: string;
  private readonly appKey: string;

  constructor(appId: string, appKey: string) {
    this.appId = appId;
    this.appKey = appKey;
  }

  async search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]> {
    // Gracefully skip if unconfigured — free tier is 1,000 req/day total across all users
    if (!this.appId || !this.appKey) return [];

    const url = new URL(`${BASE_URL}/parser`);
    url.searchParams.set('ingr', query);
    url.searchParams.set('app_id', this.appId);
    url.searchParams.set('app_key', this.appKey);
    url.searchParams.set('category', 'generic-foods');

    const startTime = Date.now();
    const { signal: fetchSignal, cleanup } = withTimeout(signal);

    try {
      const response = await fetch(url.toString(), { signal: fetchSignal });
      const latency = Date.now() - startTime;
      logger.metric('edamam_search_latency_ms', latency, { status: String(response.status) });

      if (!response.ok) {
        if (response.status === 429) logger.warn('edamam_rate_limit', {});
        else logger.warn('edamam_search_error', { status: String(response.status) });
        return [];
      }

      const data = (await response.json()) as EdamamParserResponse;
      const results: NutritionSearchResult[] = [];

      // High-confidence NLP parsed results first
      for (const item of data.parsed ?? []) {
        const mapped = mapFood(item.food);
        if (mapped) results.push(mapped);
      }

      // Broader hint matches — cap at 10 to avoid noise
      for (const hint of (data.hints ?? []).slice(0, 10)) {
        const mapped = mapFood(hint.food);
        if (mapped) results.push(mapped);
      }

      return results;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      logger.warn('edamam_search_exception', { error: (err as Error).message });
      return []; // All Edamam failures are non-fatal
    } finally {
      cleanup();
    }
  }
}

// Returns [] when unconfigured — safe to instantiate unconditionally
export const edamamAPI = new EdamamAPI(
  process.env.EXPO_PUBLIC_EDAMAM_APP_ID ?? '',
  process.env.EXPO_PUBLIC_EDAMAM_APP_KEY ?? '',
);
