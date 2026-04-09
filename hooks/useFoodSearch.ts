import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { openFoodFactsAPI } from '../lib/nutritionApi';
import type { NutritionSearchResult } from '../lib/nutritionApi';
import { logger } from '../lib/logger';
import type { FoodRow } from '../types/database';

export type { NutritionSearchResult };

export type UseFoodSearchResult = {
  localResults: FoodRow[];
  apiResults: NutritionSearchResult[];
  isSearchingApi: boolean;
};

/**
 * Unified food search: queries local DB immediately, then Open Food Facts in parallel.
 * Pass the already-debounced search query from the caller.
 */
export function useFoodSearch(query: string): UseFoodSearchResult {
  const [localResults, setLocalResults] = useState<FoodRow[]>([]);
  const [apiResults, setApiResults] = useState<NutritionSearchResult[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (controllerRef.current) controllerRef.current.abort();

    const trimmed = query.trim();
    if (!trimmed) {
      setLocalResults([]);
      setApiResults([]);
      setIsSearchingApi(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

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

    async function searchApi() {
      if (trimmed.length < 2) return;
      setIsSearchingApi(true);
      try {
        const results = await openFoodFactsAPI.search(trimmed, controller.signal);
        if (!controller.signal.aborted) setApiResults(results);
      } catch (err) {
        if (!controller.signal.aborted) {
          logger.warn('API food search error:', String(err));
          setApiResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingApi(false);
      }
    }

    void searchLocal();
    void searchApi();

    return () => {
      controller.abort();
    };
  }, [query]);

  return { localResults, apiResults, isSearchingApi };
}

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
