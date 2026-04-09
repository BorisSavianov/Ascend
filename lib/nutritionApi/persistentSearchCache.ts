import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NutritionSearchResult } from './types';

const CACHE_PREFIX = 'off_search_v1:';
const TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_KEYS = 100;

type PersistedEntry = {
  results: NutritionSearchResult[];
  timestamp: number;
};

export async function getPersistentCache(query: string): Promise<NutritionSearchResult[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + query);
    if (!raw) return null;
    const entry = JSON.parse(raw) as PersistedEntry;
    if (Date.now() - entry.timestamp > TTL_MS) {
      void AsyncStorage.removeItem(CACHE_PREFIX + query);
      return null;
    }
    return entry.results;
  } catch {
    return null;
  }
}

/**
 * Persist search results. Fire-and-forget — caller should not await.
 * Enforces a MAX_KEYS cap by evicting the oldest key when full.
 */
export async function setPersistentCache(query: string, results: NutritionSearchResult[]): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length >= MAX_KEYS) {
      // Remove the first (oldest insertion order) key
      await AsyncStorage.removeItem(cacheKeys[0]);
    }
    const entry: PersistedEntry = { results, timestamp: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + query, JSON.stringify(entry));
  } catch {
    // Non-fatal — persistent cache is best-effort
  }
}
