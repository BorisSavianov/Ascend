import type { NutritionAPI, NutritionSearchResult } from './types';
import { openFoodFactsAPI } from './openFoodFacts';
import { usdaFoodDataAPI } from './usdaFoodData';
import { edamamAPI } from './edamam';
import { offCircuitBreaker, usdaCircuitBreaker, edamamCircuitBreaker } from './circuitBreaker';
import { logger } from '../logger';

/** Trigger Edamam fallback when primary providers return fewer results than this. */
const FALLBACK_THRESHOLD = 3;

function normalizeForDedup(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Merges result sets in priority order. First occurrence of a normalized name wins.
 * Pass resultSets in priority order: [usdaResults, offResults].
 * USDA results rank first — Foundation/SR Legacy data is government-grade, analytically
 * measured. OFF second — better for branded/packaged products.
 */
function mergeAndDeduplicate(resultSets: NutritionSearchResult[][]): NutritionSearchResult[] {
  const seen = new Set<string>();
  const merged: NutritionSearchResult[] = [];

  for (const results of resultSets) {
    for (const result of results) {
      const key = normalizeForDedup(result.name);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(result);
      }
    }
  }

  return merged;
}

async function runWithCircuitBreaker(
  api: NutritionAPI,
  breaker: typeof offCircuitBreaker,
  query: string,
  signal?: AbortSignal,
): Promise<NutritionSearchResult[]> {
  if (!breaker.canAttempt()) return [];
  try {
    const results = await api.search(query, signal);
    breaker.recordSuccess();
    return results;
  } catch (err) {
    if ((err as Error).name !== 'AbortError') breaker.recordFailure();
    throw err;
  }
}

/**
 * Aggregates food search results from multiple providers:
 * 1. USDA FoodData Central (Foundation + SR Legacy) — primary for generic foods
 * 2. Open Food Facts — primary for branded/packaged foods
 * Both run in parallel. Edamam fires only as a fallback when primary results < 3.
 */
export class FoodAggregator implements NutritionAPI {
  async search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]> {
    // Phase 1: USDA and OFF in parallel
    // USDA: synonym-expanded query via expandForUSDA() (called inside USDAFoodDataAPI)
    // OFF: original query (product names are user-submitted, no expansion needed)
    const [usdaResult, offResult] = await Promise.allSettled([
      runWithCircuitBreaker(usdaFoodDataAPI, usdaCircuitBreaker, query, signal),
      runWithCircuitBreaker(openFoodFactsAPI, offCircuitBreaker, query, signal),
    ]);

    const usdaResults = usdaResult.status === 'fulfilled' ? usdaResult.value : [];
    const offResults  = offResult.status === 'fulfilled'  ? offResult.value  : [];

    if (usdaResult.status === 'rejected' && usdaResult.reason?.name !== 'AbortError') {
      logger.warn('aggregator_usda_failed', { error: usdaResult.reason?.message });
    }
    if (offResult.status === 'rejected' && offResult.reason?.name !== 'AbortError') {
      logger.warn('aggregator_off_failed', { error: offResult.reason?.message });
    }

    const primary = mergeAndDeduplicate([usdaResults, offResults]);

    // Phase 2: Edamam NLP fallback — only if primary providers returned very little.
    // Rate limit: 1,000 req/day total (shared budget) — use sparingly.
    if (primary.length < FALLBACK_THRESHOLD && edamamCircuitBreaker.canAttempt()) {
      try {
        const edamamResults = await runWithCircuitBreaker(edamamAPI, edamamCircuitBreaker, query, signal);
        logger.metric('aggregator_edamam_fallback_used', 1, {
          query, primaryCount: String(primary.length),
        });
        return mergeAndDeduplicate([primary, edamamResults]);
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        // Edamam fallback failure is non-fatal — return primary results
      }
    }

    return primary;
  }
}

export const foodAggregator = new FoodAggregator();
