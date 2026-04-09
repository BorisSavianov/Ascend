import type { NutritionSearchResult } from './types';

type CacheEntry = {
  results: NutritionSearchResult[];
  timestamp: number;
};

const MAX_ENTRIES = 200;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Simple in-memory LRU cache for OFF search results.
 * Session-scoped (not persisted) — stale nutrition data across restarts
 * is worse than a cold start.
 */
export class SearchCache {
  private cache = new Map<string, CacheEntry>();
  private _hits = 0;
  private _misses = 0;

  get(query: string): NutritionSearchResult[] | null {
    const entry = this.cache.get(query);
    if (!entry) {
      this._misses++;
      return null;
    }
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(query);
      this._misses++;
      return null;
    }
    // Move to end for LRU ordering (Map preserves insertion order)
    this.cache.delete(query);
    this.cache.set(query, entry);
    this._hits++;
    return entry.results;
  }

  set(query: string, results: NutritionSearchResult[]): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(query, { results, timestamp: Date.now() });
  }

  /** Returns true if the query is cached and not expired. Does not affect hit/miss counters. */
  has(query: string): boolean {
    const entry = this.cache.get(query);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(query);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /** Cache hit ratio as a value between 0 and 1. Returns 0 if no lookups yet. */
  get hitRatio(): number {
    const total = this._hits + this._misses;
    return total === 0 ? 0 : this._hits / total;
  }

  get hits(): number {
    return this._hits;
  }

  get misses(): number {
    return this._misses;
  }

  get size(): number {
    return this.cache.size;
  }
}

export const searchCache = new SearchCache();
