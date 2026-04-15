# Multi-Source Food Data Pipeline — Implementation Plan

> **Stack**: React Native (Expo), Supabase/PostgreSQL, client-side fetch (no backend proxy)  
> **Target**: Replace single Open Food Facts dependency with a 3-provider aggregator that handles both generic and branded foods

---

## Phase 0: Documentation Discovery (Complete)

### Existing Architecture

All food API code lives in `lib/nutritionApi/`:

| File | Purpose |
|------|---------|
| `types.ts` | `NutritionSearchResult` type, `NutritionAPI` interface |
| `openFoodFacts.ts` | `OpenFoodFactsAPI implements NutritionAPI` |
| `circuitBreaker.ts` | `CircuitBreaker` class, `offCircuitBreaker` singleton |
| `searchCache.ts` | In-memory LRU (200 entries, 5 min TTL) |
| `persistentSearchCache.ts` | AsyncStorage cache (100 entries, 30 min TTL) |
| `index.ts` | Re-exports |

**`hooks/useFoodSearch.ts`**: Dual-layer search — immediate local DB (tsvector) + debounced API call. Uses `offCircuitBreaker`, in-memory + persistent caches, and `cacheApiFood()` to upsert API results into the `foods` table.

**Database**: `foods` table has `source TEXT` and `external_id TEXT` columns with unique index on `(user_id, external_id) WHERE external_id IS NOT NULL`.

**Critical**: `NutritionSearchResult.source` is currently typed as `'openfoodfacts'` literal — must be widened to a union.

### External API Reference

| API | Auth | Rate Limit | Best For |
|-----|------|-----------|---------|
| USDA FoodData Central | API key (free signup) | 1,000 req/hr/IP | Generic/raw foods |
| Open Food Facts | None required | 10 search/min, 100 barcode/min/IP | Branded/packaged foods |
| Edamam | `app_id` + `app_key` query params | **1,000 req/day total** (shared!) | NLP fallback only |

**USDA Nutrient IDs** (confirmed from live API):
- `1008` → Energy (kcal)
- `1003` → Protein (g)
- `1004` → Total fat (g)
- `1005` → Carbohydrate (g)
- `1079` → Fiber (g)

**USDA important quirk**: Search results use *flat* nutrient format `{ nutrientId, value }`. Food detail endpoint uses *nested* format `{ nutrient: { id }, amount }`. Only use the search endpoint — avoid per-food detail calls to minimize requests.

**Edamam nutrient codes**: `ENERC_KCAL`, `PROCNT`, `FAT`, `CHOCDF`, `FIBTG`

**Edamam rate limit warning**: 1,000 req/day is shared across ALL users with the same app key. Do not use as a regular fallback. Reserve for cases where both USDA and OFF return fewer than 3 results.

---

## Phase 1: Types & Foundation

**Goal**: Widen the `source` type to a union and establish `externalId` prefix conventions. All other phases depend on this compiling cleanly.

### 1a. Modify `lib/nutritionApi/types.ts`

The current file (17 lines) defines `NutritionSearchResult` with `source: 'openfoodfacts'`. Replace entirely:

```typescript
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
```

`openFoodFacts.ts` line 52 already has `source: 'openfoodfacts'` — no change needed there since `'openfoodfacts'` satisfies the union.

### Verification

```bash
npx tsc --noEmit   # zero errors
grep -n "FoodSource" lib/nutritionApi/types.ts   # should show the export
```

---

## Phase 2: Query Normalization / Synonym Layer

**Goal**: Create a synonym expansion utility for USDA. USDA's scientific naming ("Eggs, Grade A, Large, egg whole") means a user query of "eggs" returns better Foundation results when expanded to "egg whole".

**Why USDA-only**: OFF uses a full-text index against user-submitted product names, so "eggs" works fine there. USDA's indexed descriptions use USDA-specific conventions.

### Create `lib/nutritionApi/synonyms.ts`

```typescript
/**
 * Maps common user query terms to USDA-optimized search strings.
 * Expansion targets Foundation data type (highest quality, ~1,700 foods).
 * Only applies to USDA provider — OFF and Edamam receive the original query.
 */
export const USDA_SYNONYMS: Record<string, string> = {
  // Eggs
  egg:              'egg whole raw',
  eggs:             'egg whole raw',
  // Poultry
  chicken:          'chicken breast raw',
  'chicken breast': 'chicken breast raw',
  turkey:           'turkey breast raw',
  // Beef
  beef:             'beef ground raw',
  hamburger:        'beef ground raw',
  // Pork
  pork:             'pork loin raw',
  bacon:            'pork cured bacon',
  // Fish
  salmon:           'salmon atlantic raw',
  tuna:             'tuna light canned water',
  // Dairy
  milk:             'milk whole fluid',
  yogurt:           'yogurt plain whole milk',
  cheese:           'cheese cheddar',
  butter:           'butter salted',
  // Grains
  rice:             'rice white cooked',
  oats:             'oats rolled dry',
  bread:            'bread whole wheat',
  pasta:            'pasta cooked enriched',
  // Oils
  oil:              'olive oil salad or cooking',
  'olive oil':      'olive oil salad or cooking',
  // Produce
  banana:           'bananas raw',
  apple:            'apples raw',
  potato:           'potato baked flesh and skin',
  broccoli:         'broccoli raw',
  spinach:          'spinach raw',
  // Legumes
  beans:            'beans kidney cooked boiled',
  lentils:          'lentils cooked boiled',
};

/**
 * Expands a user query for USDA search.
 * Returns the synonym expansion if found; otherwise the original query unchanged.
 */
export function expandForUSDA(query: string): string {
  return USDA_SYNONYMS[query.toLowerCase().trim()] ?? query;
}
```

### Verification

```bash
grep -n "expandForUSDA\|USDA_SYNONYMS" lib/nutritionApi/synonyms.ts
```

---

## Phase 3: USDA FoodData Central Implementation

**Goal**: Implement `USDAFoodDataAPI implements NutritionAPI`.

**Patterns to follow**: Copy the retry loop, `abortableDelay`, `withTimeout`, and `round1` functions from `openFoodFacts.ts` (lines 26–106). These utilities are duplicated for now (each provider is self-contained). Extracting to a shared `utils.ts` is a future cleanup.

### Create `lib/nutritionApi/usdaFoodData.ts`

```typescript
import type { NutritionAPI, NutritionSearchResult } from './types';
import { logger } from '../logger';
import { expandForUSDA } from './synonyms';

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const TIMEOUT_MS = 5_000;
const MAX_RETRIES = 3;

// Confirmed USDA nutrient IDs from live API (FoodData Central API Guide)
const NUTRIENT = {
  CALORIES: 1008,
  PROTEIN:  1003,
  FAT:      1004,
  CARBS:    1005,
  FIBER:    1079,
} as const;

// Flat format used in /foods/search responses (different from /food/{id} nested format)
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

// Pattern copied from openFoodFacts.ts — see lines 64-106 for original
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
```

### Add circuit breaker to `lib/nutritionApi/circuitBreaker.ts`

Read the existing file, then append after the `offCircuitBreaker` export:

```typescript
export const usdaCircuitBreaker = new CircuitBreaker();
```

### Verification

```bash
grep -n "USDAFoodDataAPI\|usdaFoodDataAPI" lib/nutritionApi/usdaFoodData.ts
grep -n "usdaCircuitBreaker" lib/nutritionApi/circuitBreaker.ts
npx tsc --noEmit
```

---

## Phase 4: Edamam API Implementation

**Goal**: Implement `EdamamAPI implements NutritionAPI` as a graceful last-resort fallback. Must return `[]` — never throw — when unconfigured or on any non-abort error.

**API details**:
- Endpoint: `GET https://api.edamam.com/api/food-database/v2/parser`
- Auth: `?app_id=X&app_key=Y` query params
- Response: `parsed[]` (high-confidence NLP) + `hints[]` (broader matches)
- Nutrient codes: `ENERC_KCAL`, `PROCNT`, `FAT`, `CHOCDF`, `FIBTG` (all per 100g)
- No retry needed — on the free tier, retrying a 429 is wasteful

### Create `lib/nutritionApi/edamam.ts`

```typescript
import type { NutritionAPI, NutritionSearchResult } from './types';
import { logger } from '../logger';

const BASE_URL = 'https://api.edamam.com/api/food-database/v2';
const TIMEOUT_MS = 5_000;

type EdamamNutrients = {
  ENERC_KCAL?: number;
  PROCNT?: number;
  FAT?: number;
  CHOCDF?: number;
  FIBTG?: number;
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
```

### Add circuit breaker to `lib/nutritionApi/circuitBreaker.ts`

Append after `usdaCircuitBreaker`:

```typescript
export const edamamCircuitBreaker = new CircuitBreaker();
```

### Verification

```bash
grep -n "EdamamAPI\|edamamAPI" lib/nutritionApi/edamam.ts
grep -n "edamamCircuitBreaker" lib/nutritionApi/circuitBreaker.ts
npx tsc --noEmit
```

---

## Phase 5: Multi-Source Aggregator

**Goal**: Create `FoodAggregator implements NutritionAPI` — the single entry point for all food search. Orchestrates providers with explicit priority, parallel execution, deduplication, and Edamam fallback.

### Design decisions (documented in code)

1. **USDA + OFF run in parallel** (`Promise.allSettled`) — both are free and fast, ~150-200ms each. Sequential would add latency unnecessarily.
2. **USDA results ranked first** — Foundation/SR Legacy data is government-grade, analytically measured. OFF data is crowdsourced and varies.
3. **Deduplication by normalized name** — when same food appears from multiple sources, the first occurrence (USDA priority) wins. Normalization: lowercase + trim + collapse whitespace.
4. **Edamam fires only if < 3 results from primary providers** — conserves the 1,000/day budget.
5. **Circuit breakers checked before each provider** — OPEN circuit → skip provider entirely rather than queueing failing calls.

### Create `lib/nutritionApi/aggregator.ts`

```typescript
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
  breaker: import('./circuitBreaker').CircuitBreaker,
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

export class FoodAggregator implements NutritionAPI {
  async search(query: string, signal?: AbortSignal): Promise<NutritionSearchResult[]> {
    // Phase 1: USDA and OFF in parallel
    // USDA: synonym-expanded query for better Foundation results
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

    // USDA first: higher quality for generic foods. OFF second: better for branded.
    const primary = mergeAndDeduplicate([usdaResults, offResults]);

    // Phase 2: Edamam NLP fallback — only if primary providers returned very little
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
```

### Verification

```bash
grep -n "FoodAggregator\|foodAggregator\|FALLBACK_THRESHOLD" lib/nutritionApi/aggregator.ts
npx tsc --noEmit
```

---

## Phase 6: Index & Hook Integration

**Goal**: Wire up the aggregator as the single search entry point. Update `useFoodSearch` to use `foodAggregator` and fix `cacheApiFood` to derive `source` from the `externalId` prefix.

### 6a. Replace `lib/nutritionApi/index.ts`

Current file (4 lines). Replace entirely:

```typescript
export type { NutritionSearchResult, NutritionAPI, FoodSource } from './types';
export { openFoodFactsAPI } from './openFoodFacts';
export { usdaFoodDataAPI } from './usdaFoodData';
export { edamamAPI } from './edamam';
export { foodAggregator } from './aggregator';
export { searchCache } from './searchCache';
export {
  offCircuitBreaker,
  usdaCircuitBreaker,
  edamamCircuitBreaker,
} from './circuitBreaker';
```

### 6b. Update `hooks/useFoodSearch.ts`

**Change 1** — Swap import: replace `openFoodFactsAPI` and `offCircuitBreaker` with `foodAggregator`.

```typescript
// Before (find this import line):
import { openFoodFactsAPI, offCircuitBreaker, searchCache, ... } from '@/lib/nutritionApi';

// After:
import { foodAggregator, searchCache, ... } from '@/lib/nutritionApi';
// Note: circuit breaker checks are now inside FoodAggregator — remove offCircuitBreaker from imports
```

**Change 2** — Swap the API call in the debounced search effect. Find the section that checks `offCircuitBreaker.canAttempt()` and calls `openFoodFactsAPI.search()`:

```typescript
// Before:
if (!offCircuitBreaker.canAttempt()) return;
const results = await openFoodFactsAPI.search(normalized, signal);
offCircuitBreaker.recordSuccess();

// After (circuit breaker management is inside the aggregator):
const results = await foodAggregator.search(normalized, signal);
```

Also remove any `offCircuitBreaker.recordFailure()` in the catch block — handled inside the aggregator.

**Change 3** — Fix `cacheApiFood` to derive `source` from `externalId` prefix:

```typescript
import type { FoodSource } from '@/lib/nutritionApi';

function deriveSource(externalId: string): FoodSource {
  if (externalId.startsWith('usda:')) return 'usda';
  if (externalId.startsWith('edamam:')) return 'edamam';
  return 'openfoodfacts';
}

// Inside cacheApiFood(), in the upsert call, change:
//   source: 'openfoodfacts',
// to:
//   source: deriveSource(result.externalId),
```

### Verification

```bash
# openFoodFactsAPI must NOT appear in useFoodSearch (only in the aggregator)
grep -n "openFoodFactsAPI\|offCircuitBreaker" hooks/useFoodSearch.ts
# expected: 0 lines

grep -n "foodAggregator\|deriveSource" hooks/useFoodSearch.ts
# expected: multiple lines

npx tsc --noEmit
```

---

## Phase 7: Environment Setup

### Add to `.env.local` (gitignored)

```bash
# USDA FoodData Central
# Free signup: https://fdc.nal.usda.gov/api-key-signup.html
# Rate limit: 1,000 req/hr per IP (per-device for mobile — safe for production)
EXPO_PUBLIC_USDA_API_KEY=

# Edamam Food Database (optional — omit to disable Edamam fallback)
# Free tier: 1,000 req/DAY across ALL users — upgrade before production at any scale
# Signup: https://developer.edamam.com/food-database-api
EXPO_PUBLIC_EDAMAM_APP_ID=
EXPO_PUBLIC_EDAMAM_APP_KEY=
```

### Add to `.env.example` (committed)

Same content as above, but with empty values.

### Verification

```bash
grep -n "EXPO_PUBLIC_USDA_API_KEY\|EXPO_PUBLIC_EDAMAM" .env.example
```

---

## Phase 8: Final Verification

### Automated checks

```bash
# 1. All provider files exist
ls lib/nutritionApi/{openFoodFacts,usdaFoodData,edamam,aggregator,synonyms}.ts

# 2. FoodSource union type is exported
grep -n "FoodSource" lib/nutritionApi/types.ts lib/nutritionApi/index.ts

# 3. Circuit breakers for all three providers
grep -n "offCircuitBreaker\|usdaCircuitBreaker\|edamamCircuitBreaker" lib/nutritionApi/circuitBreaker.ts

# 4. No remaining direct openFoodFactsAPI usage in useFoodSearch
grep -n "openFoodFactsAPI" hooks/useFoodSearch.ts   # must be empty

# 5. source derivation function present
grep -n "deriveSource" hooks/useFoodSearch.ts

# 6. No hardcoded 'openfoodfacts' source outside of openFoodFacts.ts
grep -rn "source: 'openfoodfacts'" --include="*.ts" | grep -v "openFoodFacts.ts"

# 7. TypeScript compilation
npx tsc --noEmit
```

### Manual spot-checks (in dev build)

| Query | Expected top result source | Expected behavior |
|-------|---------------------------|-------------------|
| "eggs" | `usda` | "Eggs, Grade A, Large, egg whole" from Foundation |
| "chicken breast" | `usda` | "Chicken, broilers or fryers, breast, meat only, raw" |
| "Kellogg" | `openfoodfacts` | Branded packaged products with brand name |
| "Nutella" | `openfoodfacts` | OFF branded product |
| Search when USDA key missing | `openfoodfacts` | Graceful fallback, no crash |
| Log a USDA food → check Supabase | — | `foods.source = 'usda'`, not `'openfoodfacts'` |

---

## Architecture Summary

```
User types query
       │
       ▼
useFoodSearch (hook)
  ├─ [immediate]    Local DB: tsvector FTS on (name, name_local, brand)
  └─ [debounced]    foodAggregator.search(normalizedQuery)
                              │
                    ┌─────────┴────────────┐
                    ▼                      ▼
              USDA FoodData         Open Food Facts
           expandForUSDA(q)         original query
           POST /foods/search       GET /cgi/search.pl
           Foundation+SR Legacy     page_size=10
           (1,000 req/hr/IP)        (10 req/min/IP)
                    │                      │
                    └─────────┬────────────┘
                              ▼
              Promise.allSettled → mergeAndDeduplicate
              [USDA first — higher quality for generic foods]
                              │
                      < 3 results?
                         │       │
                        yes      no
                         │       └──► cache → return to hook
                         ▼
                  Edamam /parser
                  (NLP fallback)
                  1,000 req/day
                  (free tier shared!)
                         │
                         ▼
              mergeAndDeduplicate([primary, edamamResults])
                         │
                         ▼
                 cache → return to hook
```

```
Provider         Source Type           Data Quality     Rate Limit          Cost
─────────────────────────────────────────────────────────────────────────────────
USDA FDC         Generic/raw foods     Govt analytical  1,000 req/hr/IP     Free (key req)
Open Food Facts  Branded/packaged      Crowdsourced     10 search/min/IP    Free
Edamam           NLP fallback          Curated          1,000 req/DAY total Free → $19+/mo
```

### Database write-through

When a user selects any food from search results, `cacheApiFood()` upserts to the `foods` table:
- `source`: `'usda'` | `'openfoodfacts'` | `'edamam'` (derived from `externalId` prefix)
- `external_id`: full prefixed ID (e.g., `"usda:748967"`)
- Conflict resolution: `ON CONFLICT (user_id, external_id)` — idempotent

This means frequently-used foods become local DB entries and are served from tsvector search (zero latency, zero API calls) on subsequent searches.
