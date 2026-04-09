import type { NutritionAPI, NutritionSearchResult } from './types';
import { logger } from '../logger';

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
  image_front_small_url?: string;
  nutriments?: OFFNutriments;
};

type OFFSearchResponse = {
  products: OFFProduct[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Reject obviously-invalid nutrition values from the API. */
function isReasonableCalories(kcal: number): boolean {
  // Pure fat maxes at ~900 kcal/100g
  return kcal >= 0 && kcal <= 950;
}

function mapProduct(p: OFFProduct): NutritionSearchResult | null {
  const name = p.product_name?.trim();
  const calories = p.nutriments?.['energy-kcal_100g'];
  if (!name || calories == null || !p.code) return null;
  if (!isReasonableCalories(calories)) return null;

  return {
    externalId: p.code,
    name,
    brand: p.brands?.trim() || undefined,
    imageUrl: p.image_front_small_url?.trim() || undefined,
    caloriesPer100g: round1(calories),
    proteinPer100g: round1(p.nutriments?.proteins_100g ?? 0),
    fatPer100g: round1(p.nutriments?.fat_100g ?? 0),
    carbsPer100g: round1(p.nutriments?.carbohydrates_100g ?? 0),
    fiberPer100g: round1(p.nutriments?.fiber_100g ?? 0),
    source: 'openfoodfacts',
  };
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5_000;
const USER_AGENT = 'AscendTracker/1.0 (https://github.com/BorisSavianov/Ascend)';

/**
 * Returns a promise that resolves after `ms` but rejects immediately
 * if `signal` is aborted — prevents retry delays from outliving their caller.
 */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Compose an AbortSignal that fires when *either* the caller's signal
 * or an internal timeout fires. Uses manual AbortController composition.
 */
function withTimeout(callerSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);

  if (callerSignal) {
    const onAbort = () => timeoutController.abort();
    callerSignal.addEventListener('abort', onAbort, { once: true });
    return {
      signal: timeoutController.signal,
      cleanup: () => {
        clearTimeout(timer);
        callerSignal.removeEventListener('abort', onAbort);
      },
    };
  }

  return {
    signal: timeoutController.signal,
    cleanup: () => clearTimeout(timer),
  };
}

export class OpenFoodFactsAPI implements NutritionAPI {
  async search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]> {
    const params = new URLSearchParams({
      action: 'process',
      json: '1',
      search_terms: query,
      fields: 'code,product_name,brands,nutriments,image_front_small_url',
      page_size: '10',
      sort_by: 'popularity_key',
    });

    const url = `${BASE_URL}?${params}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      if (attempt > 0) {
        // Exponential backoff: 1s, 2s — cancelable if caller aborts
        const delay = Math.min(1000 * 2 ** (attempt - 1), 4000);
        await abortableDelay(delay, signal);
      }

      const startTime = Date.now();
      const { signal: fetchSignal, cleanup } = withTimeout(signal);

      try {
        const response = await fetch(url, {
          signal: fetchSignal,
          headers: { 'User-Agent': USER_AGENT },
        });

        const latency = Date.now() - startTime;

        if (response.ok) {
          const data = (await response.json()) as OFFSearchResponse;
          const results = data.products
            .map(mapProduct)
            .filter((r): r is NutritionSearchResult => r !== null);
          logger.metric('off_search_latency_ms', latency, { attempt: String(attempt), status: 'ok' });
          return results;
        }

        // Retry on server errors (5xx), throw on client errors (4xx)
        logger.metric('off_search_latency_ms', latency, { attempt: String(attempt), status: String(response.status) });
        if (response.status < 500) {
          throw new Error(`OpenFoodFacts search failed: ${response.status}`);
        }
        lastError = new Error(`OpenFoodFacts search failed: ${response.status}`);
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        lastError = err as Error;
        logger.metric('off_search_latency_ms', Date.now() - startTime, {
          attempt: String(attempt),
          status: 'error',
          error: (err as Error).message,
        });
        // Retry on network / timeout errors
      } finally {
        cleanup();
      }
    }

    throw lastError ?? new Error('OpenFoodFacts search failed after retries');
  }
}

export const openFoodFactsAPI = new OpenFoodFactsAPI();
