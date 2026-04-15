import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { foodAggregator, searchCache } from '../lib/nutritionApi';
import type { NutritionSearchResult } from '../lib/nutritionApi';
import { getPersistentCache, setPersistentCache } from '../lib/nutritionApi/persistentSearchCache';
import { logger } from '../lib/logger';
import type { FoodRow } from '../types/database';

export type { NutritionSearchResult };

export type UseFoodSearchResult = {
  localResults: FoodRow[];
  apiResults: NutritionSearchResult[];
  isSearchingApi: boolean;
};

// ── Query normalization ────────────────────────────────────────────────────────

const MAX_QUERY_LENGTH = 100;
const API_DEBOUNCE_MS = 400;

/**
 * Normalize a raw search string: trim, collapse whitespace, lowercase, clamp.
 * This ensures "Chicken", "  chicken  ", and "CHICKEN" all resolve to the same
 * cache key and produce identical API requests.
 */
function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Unified food search: queries local DB immediately on input change,
 * then OpenFoodFacts API after a longer debounce. Results are deduplicated.
 *
 * Includes: query normalization, in-memory cache, circuit breaker,
 * and split debounce (local = immediate, API = 400 ms).
 */
export function useFoodSearch(query: string): UseFoodSearchResult {
  const [localResults, setLocalResults] = useState<FoodRow[]>([]);
  const [apiResults, setApiResults] = useState<NutritionSearchResult[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  // Separate debounced query for the API branch (400 ms)
  const [debouncedApiQuery, setDebouncedApiQuery] = useState('');

  const localControllerRef = useRef<AbortController | null>(null);
  const apiControllerRef = useRef<AbortController | null>(null);
  const pendingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Local search — runs immediately on normalized query ──────────────────
  useEffect(() => {
    if (localControllerRef.current) localControllerRef.current.abort();

    const trimmed = normalizeQuery(query);
    if (!trimmed) {
      setLocalResults([]);
      return;
    }

    const controller = new AbortController();
    localControllerRef.current = controller;

    async function searchLocal() {
      const base = supabase.from('foods').select('*').abortSignal(controller.signal);
      const escapedQ = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const ftsQ = trimmed.replace(/[!|&<>()]/g, ' ').trim();
      const filtered =
        trimmed.length >= 2
          ? base.textSearch('search_vector', ftsQ, { type: 'websearch' })
          : base.ilike('name', `%${escapedQ}%`);
      const { data, error } = await filtered.limit(20);
      if (controller.signal.aborted) return;
      if (error) logger.warn('Local food search error:', error.message);
      else setLocalResults(data ?? []);
    }

    void searchLocal();

    return () => {
      controller.abort();
    };
  }, [query]);

  // ── API debounce — adaptive: 0 ms on persistent cache hit, 400 ms otherwise ─
  useEffect(() => {
    const trimmed = normalizeQuery(query);
    if (!trimmed || trimmed.length < 2) {
      setDebouncedApiQuery('');
      setApiResults([]);
      setIsSearchingApi(false);
      return;
    }

    // Check persistent (or in-memory) cache — if hit, apply with no delay
    let cancelled = false;
    // Check caches without affecting hit/miss counters (the API effect does the official lookup).
    const inMemoryHit = searchCache.has(trimmed);
    const persistedPromise = inMemoryHit ? Promise.resolve(true) : getPersistentCache(trimmed).then(r => r !== null);

    persistedPromise.then(hit => {
      if (cancelled) return;
      const delay = hit ? 0 : API_DEBOUNCE_MS;
      if (delay === 0) {
        setDebouncedApiQuery(trimmed);
      } else {
        const timer = setTimeout(() => setDebouncedApiQuery(trimmed), delay);
        // Can't clear this inner timer from the outer cleanup, but the API
        // effect guards against stale queries via AbortController.
        // Store it so cleanup can cancel if query changes before it fires.
        pendingDebounceRef.current = timer;
      }
    }).catch(() => {
      if (!cancelled) {
        const timer = setTimeout(() => setDebouncedApiQuery(trimmed), API_DEBOUNCE_MS);
        pendingDebounceRef.current = timer;
      }
    });

    return () => {
      cancelled = true;
      if (pendingDebounceRef.current !== null) {
        clearTimeout(pendingDebounceRef.current);
        pendingDebounceRef.current = null;
      }
    };
  }, [query]);

  // ── API search — fires on debounced query with cache + circuit breaker ───
  useEffect(() => {
    if (apiControllerRef.current) apiControllerRef.current.abort();

    if (!debouncedApiQuery) {
      return;
    }

    // Check in-memory cache first
    const cached = searchCache.get(debouncedApiQuery);
    if (cached) {
      setApiResults(cached);
      setIsSearchingApi(false);
      logger.metric('search_cache_hit', 1, { query: debouncedApiQuery });
      return;
    }

    const controller = new AbortController();
    apiControllerRef.current = controller;

    async function searchApi() {
      setIsSearchingApi(true);
      try {
        // Check persistent cache before hitting the network
        const persisted = await getPersistentCache(debouncedApiQuery);
        if (persisted && !controller.signal.aborted) {
          setApiResults(persisted);
          searchCache.set(debouncedApiQuery, persisted);
          setIsSearchingApi(false);
          logger.metric('search_persistent_cache_hit', 1, { query: debouncedApiQuery });
          return;
        }

        const results = await foodAggregator.search(debouncedApiQuery, controller.signal);
        if (!controller.signal.aborted) {
          setApiResults(results);
          searchCache.set(debouncedApiQuery, results);
          // Persist for future sessions — fire-and-forget
          void setPersistentCache(debouncedApiQuery, results);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          logger.warn('API food search error:', String(err));
          setApiResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingApi(false);
      }
    }

    void searchApi();

    return () => {
      controller.abort();
    };
  }, [debouncedApiQuery]);

  // Periodically log cache metrics in dev (every 30 s while mounted)
  useEffect(() => {
    if (!__DEV__) return;
    const interval = setInterval(() => {
      if (searchCache.size > 0) {
        logger.metric('off_cache_hit_ratio', searchCache.hitRatio, {
          hits: String(searchCache.hits),
          misses: String(searchCache.misses),
          size: String(searchCache.size),
        });
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { localResults, apiResults, isSearchingApi };
}

// ── Write-through cache ────────────────────────────────────────────────────────

/**
 * Cache an API food result in the local foods table (upsert by user+external_id).
 * Returns the persisted FoodRow so it can immediately be turned into a MealItemDraft.
 */
export async function cacheApiFood(result: NutritionSearchResult): Promise<FoodRow> {
  const { data, error } = await supabase
    .from('foods')
    .upsert(
      {
        name: result.name,
        brand: result.brand ?? null,
        calories_per_100g: result.caloriesPer100g,
        protein_per_100g: result.proteinPer100g,
        fat_per_100g: result.fatPer100g,
        carbs_per_100g: result.carbsPer100g,
        fiber_per_100g: result.fiberPer100g,
        is_custom: false,
        source: result.source,
        external_id: result.externalId,
      },
      { onConflict: 'user_id,external_id', ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to cache food');
  return data;
}
