# Meal Logging, Move Animations & Navigation Consistency — Implementation Plan

> **Stack**: React Native (Expo), Expo Router ~4.0.0, react-native-reanimated ~3.16.0, Zustand, TanStack React Query, Supabase  
> **Scope**: Fix USDA API display bug, improve Log Meal UX, enhance Move page animations, standardise navigation across Today/History/Templates

---

## Phase 0: Documentation Discovery (Complete)

### Confirmed Architecture (from codebase exploration)

#### Food Search Pipeline — `lib/nutritionApi/`

| File | Status | Notes |
|------|--------|-------|
| `aggregator.ts` | ✅ Correct | `Promise.allSettled` parallel USDA+OFF, Edamam fallback at <3 results |
| `usdaFoodData.ts` | ⚠️ Bug risk | `mapFood` filters out foods where `nutrientId 1008` is absent — some Foundation records may use `2047`/`2048` |
| `openFoodFacts.ts` | ✅ Working | |
| `circuitBreaker.ts` | ✅ Working | 3-failure threshold, 30 s reset, in-memory only |
| `searchCache.ts` | ✅ Working | LRU 200 entries, 5 min TTL |

**API Key**: `EXPO_PUBLIC_USDA_API_KEY` is set in `.env` — key IS present.

#### Confirmed UI Bug — `app/(tabs)/log.tsx:188-191`

```tsx
// BUG: all API results (USDA + OFF combined) are shown under one label
if (dedupedApi.length > 0) {
  items.push({ type: 'section', label: 'Open Food Facts' });   // ← hardcoded wrong label
  items.push(...dedupedApi.map((r): SearchItem => ({ type: 'api', result: r })));
}
```

`NutritionSearchResult.source` (`'usda' | 'openfoodfacts' | 'edamam'`) is already populated by the aggregator and available in each result — just not used for grouping.

#### Navigation Inconsistency — `app/(tabs)/move/`

| Screen | Header | Container | Safe Area |
|--------|--------|-----------|-----------|
| `index.tsx` | `AppHeader` | `Screen` | Delegated to Screen |
| `history.tsx` | Custom `View` (lines 82–103) | Raw `View` | Manual `useSafeAreaInsets` |
| `templates.tsx` | `AppHeader` | `Screen` | Delegated to Screen |

#### Move Animations — already-present Reanimated usage

- `move/index.tsx`: `FadeInDown.duration(200)` / `FadeOutUp` on section enter/exit
- `workout/[sessionId].tsx`: `withTiming` animated progress bar
- `WorkoutExerciseCard.tsx`: `FadeInDown`/`FadeOutUp`, auto-collapse after completion (600 ms delay)
- `WorkoutSetRow.tsx`: `interpolateColor` on set completion

### Allowed APIs & Patterns

```
Animation  react-native-reanimated ~3.16.0
           - useSharedValue, useAnimatedStyle, withTiming, withSpring
           - FadeInDown, FadeOutUp, FadeIn, SlideInRight
           - interpolateColor
           - useReducedMotionPreference() — always wrap motion in accessibility guard

Motion     lib/theme.ts  (motion object)
           motion.duration.fast         50 ms — snap feedback
           motion.duration.standard     220 ms — standard transitions
           motion.duration.deliberate   350 ms — card/section animations
           motion.spring.snappy         { damping: 28, stiffness: 400 } — press feedback
           motion.spring.default        { damping: 22, stiffness: 280 } — card transitions
           motion.pressScale            0.96

Components components/ui/ (all production-ready)
           Screen, AppHeader, Surface, Button, SegmentedControl
           SkeletonBox, SkeletonText, Toast, BottomActionBar
           
Styling    Inline styles + theme tokens from lib/theme.ts
           NEVER hardcode hex values; use colors.*, spacing.*, typography.*

Navigation Expo Router ~4.0.0
           router.push(), router.back(), router.replace()
           NEVER call React Navigation APIs directly
```

### Anti-Patterns

- Do NOT use legacy `Animated` API (except in `MealItemRow` Swipeable — leave as-is)
- Do NOT hardcode hex values, font sizes, or spacing numbers
- Do NOT animate layout-recalculating properties (`width`, `height` of container); use `scaleX`/`opacity`/`translateY`
- Do NOT set animation durations longer than `motion.duration.deliberate` (350 ms) for interactive elements
- Do NOT create new header implementations; use `AppHeader` from `components/ui/`
- Do NOT bypass `useReducedMotionPreference()` for motion-heavy UI

---

## Phase 1: Fix USDA Results Display & Nutrient Parsing

**Goal**: Surface USDA results correctly in the UI and harden the nutrient extraction.

### Task 1.1 — Fix Nutrient ID Fallback in `mapFood`

**File**: `lib/nutritionApi/usdaFoodData.ts`

**Problem**: `NUTRIENT.CALORIES = 1008` is the primary energy nutrient ID. Some USDA Foundation/SR Legacy records report energy as `2047` (Atwater General Factors) or `2048` (Atwater Specific Factors). When `1008` is absent `getNutrient()` returns `0`, which causes `mapFood` to `return null` and silently discard the food.

**Change**: Update `NUTRIENT` and `getNutrient` to try multiple IDs for calories.

```typescript
// lib/nutritionApi/usdaFoodData.ts

// Before (line 11–17):
const NUTRIENT = {
  CALORIES: 1008,
  ...
} as const;

function getNutrient(nutrients: USDANutrient[], id: number): number {
  return nutrients.find(n => n.nutrientId === id)?.value ?? 0;
}

// After:
const NUTRIENT = {
  CALORIES:  [1008, 2047, 2048] as const,   // energy (kcal): multiple USDA IDs
  PROTEIN:   1003,
  FAT:       1004,
  CARBS:     1005,
  FIBER:     1079,
} as const;

function getNutrient(nutrients: USDANutrient[], id: number | readonly number[]): number {
  if (typeof id === 'number') {
    return nutrients.find(n => n.nutrientId === id)?.value ?? 0;
  }
  for (const eid of id) {
    const match = nutrients.find(n => n.nutrientId === eid);
    if (match !== undefined) return match.value;
  }
  return 0;
}

// mapFood — no change needed; calorie call now resolves the array:
const calories = getNutrient(food.foodNutrients, NUTRIENT.CALORIES);
```

**Verification**:
- Search for "salmon" → at least one USDA result returned
- Search for "oats" → USDA result with correct calorie value appears
- `mapFood` unit-testable: pass mock with only `nutrientId: 2047` → should no longer return `null`

---

### Task 1.2 — Fix Section Labels to Reflect Actual Source

**File**: `app/(tabs)/log.tsx`, lines 169–193

**Problem**: `dedupedApi` is a flat merged array from all providers. The section label is hardcoded `'Open Food Facts'`, hiding USDA results.

**Change**: Replace the single `dedupedApi` block with per-source grouping.

```typescript
// app/(tabs)/log.tsx — replace searchData useMemo (lines 175–193)

const searchData: SearchItem[] = useMemo(() => {
  const localExternalIds = new Set(
    localResults.map((f) => f.external_id).filter(Boolean),
  );
  const dedupedApi = apiResults.filter((r) => !localExternalIds.has(r.externalId));

  const usdaResults   = dedupedApi.filter((r) => r.source === 'usda');
  const offResults    = dedupedApi.filter((r) => r.source === 'openfoodfacts');
  const edamamResults = dedupedApi.filter((r) => r.source === 'edamam');

  const items: SearchItem[] = [];

  if (localResults.length > 0) {
    items.push({ type: 'section', label: 'Your foods' });
    items.push(...localResults.map((f): SearchItem => ({ type: 'local', food: f })));
  }
  if (usdaResults.length > 0) {
    items.push({ type: 'section', label: 'USDA FoodData' });
    items.push(...usdaResults.map((r): SearchItem => ({ type: 'api', result: r })));
  }
  if (offResults.length > 0) {
    items.push({ type: 'section', label: 'Open Food Facts' });
    items.push(...offResults.map((r): SearchItem => ({ type: 'api', result: r })));
  }
  if (edamamResults.length > 0) {
    items.push({ type: 'section', label: 'Edamam' });
    items.push(...edamamResults.map((r): SearchItem => ({ type: 'api', result: r })));
  }

  return items;
}, [localResults, apiResults]);
```

**Also update** the `accessibilityHint` on the `TextField` (line 215):
```tsx
accessibilityHint="Type a food name to search your foods and nutrition databases"
```

**Verification**:
- Search "chicken" → two distinct sections appear: "USDA FoodData" and "Open Food Facts"
- Search a branded food (e.g. "oreo") → only "Open Food Facts" section
- Empty USDA result → only "Open Food Facts" section appears (no blank USDA header)

---

## Phase 2: Log Meal UI Polish

**Goal**: Improve information hierarchy on food cards and add running macro totals.

### Task 2.1 — Enrich API Food Cards with Macro Display

**File**: `app/(tabs)/log.tsx` — `ApiSearchRow` component (after line 395)

**Current state**: `ApiSearchRow` shows food name + calories. Macros are hidden.

**Change**: Display calories prominently and add compact protein/carbs/fat line. Add a source badge distinguishing USDA from OFF.

```tsx
// Find ApiSearchRow in log.tsx and update its render:

function ApiSearchRow({
  result,
  onPress,
}: {
  result: NutritionSearchResult;
  onPress: () => void;
}) {
  const sourceLabel = result.source === 'usda' ? 'USDA' : result.source === 'openfoodfacts' ? 'OFF' : 'EDM';
  const sourceColor = result.source === 'usda' ? colors.accent.primaryMuted : colors.bg.surfaceOverlay;

  return (
    <Pressable onPress={onPress} style={{ ... }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={typography.body} numberOfLines={1}>
            {result.name}
          </Text>
          {/* Source badge */}
          <View style={{ backgroundColor: sourceColor, borderRadius: radius.xs, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>{sourceLabel}</Text>
          </View>
        </View>
        {/* Macro summary */}
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
          {result.caloriesPer100g} kcal · {result.proteinPer100g}g P · {result.carbsPer100g}g C · {result.fatPer100g}g F  (per 100 g)
        </Text>
      </View>
      <Button label="Add" variant="secondary" size="sm" onPress={onPress} />
    </Pressable>
  );
}
```

Import `radius` from `lib/theme.ts` alongside `colors`, `spacing`, `typography`.

**Verification**:
- USDA food cards show blue-tinted "USDA" badge
- OFF food cards show "OFF" badge
- Macro line appears below food name for all API results

---

### Task 2.2 — Add Macro Totals to Bottom Bar

**File**: `app/(tabs)/log.tsx`, lines 350–388 (BottomActionBar section)

**Current state**: BottomActionBar shows only total calories and item count.

**Change**: Add protein/carbs/fat totals alongside calories.

```typescript
// Add after totalCalories calculation (around line 99):
const totalMacros = selectedItems.reduce(
  (acc, item) => {
    const n = calculateNutrition(
      { calories_per_100g: item.caloriesPer100g, protein_per_100g: item.proteinPer100g,
        fat_per_100g: item.fatPer100g, carbs_per_100g: item.carbsPer100g, fiber_per_100g: item.fiberPer100g },
      item.amountG,
    );
    return { protein: acc.protein + n.proteinG, carbs: acc.carbs + n.carbsG, fat: acc.fat + n.fatG };
  },
  { protein: 0, carbs: 0, fat: 0 },
);
```

```tsx
// In BottomActionBar, replace the calories display block:
<View>
  <Text style={typography.caption}>Current total</Text>
  <Text style={[typography.h3, { marginTop: spacing.xs, fontFamily: fontFamily.monoMedium, fontVariant: ['tabular-nums'] }]}>
    {formatCalories(totalCalories)} kcal
  </Text>
  {selectedItems.length > 0 && (
    <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs, fontVariant: ['tabular-nums'] }]}>
      {Math.round(totalMacros.protein)}g P · {Math.round(totalMacros.carbs)}g C · {Math.round(totalMacros.fat)}g F
    </Text>
  )}
</View>
```

**Verification**:
- No items selected → macro row is hidden
- Add 200g chicken → macro row shows protein/carbs/fat totals
- Amounts update live when `MealItemRow` amount changes

---

## Phase 3: Move Page Animations

**Goal**: Add meaningful micro-interactions that feel responsive without over-animating.

### Task 3.1 — Animate Set Completion Checkmark Scale

**File**: `components/WorkoutSetRow.tsx`

**Current state**: `interpolateColor` exists for background, but completion toggle lacks tactile scale feedback.

**Change**: Add `withSpring(1, motion.spring.snappy)` scale pulse on the completion button press.

```typescript
// In WorkoutSetRow.tsx — add alongside existing interpolateColor:
import { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolateColor } from 'react-native-reanimated';
import { motion } from '../lib/theme';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';

// Inside component:
const checkScale = useSharedValue(1);
const reducedMotion = useReducedMotionPreference();

const checkAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: checkScale.value }],
}));

function handleToggle() {
  if (!reducedMotion) {
    checkScale.value = withSpring(0.8, motion.spring.snappy, () => {
      checkScale.value = withSpring(1, motion.spring.snappy);
    });
  }
  onToggle(set.id);
}

// Wrap the completion button in Animated.View with checkAnimStyle
```

**Verification**:
- Tap set complete → checkmark briefly scales down then bounces back
- Reduced motion setting on device → no scale animation, toggle still works
- No layout jank (scale does not cause parent reflow)

---

### Task 3.2 — Animate Workout Progress Counter

**File**: `components/WorkoutProgressBar.tsx`

**Current state**: Animated `withTiming` progress bar width. Set counter text is static.

**Change**: Animate the "X / Y sets" counter with a brief scale bump when the number changes.

```typescript
// In WorkoutProgressBar.tsx
import { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { motion } from '../lib/theme';
import { useEffect } from 'react';

// Inside component:
const countScale = useSharedValue(1);

useEffect(() => {
  countScale.value = withSequence(
    withTiming(1.15, { duration: motion.duration.fast }),
    withTiming(1,    { duration: motion.duration.fast }),
  );
}, [completedSets]);  // fires on each set completion

const countAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: countScale.value }],
}));

// Wrap the "X / Y" Text in <Animated.View style={countAnimStyle}>
```

**Verification**:
- Complete a set → "3 / 8" counter briefly scales up then returns to 1
- Animation does not interfere with the progress bar width animation

---

### Task 3.3 — Exercise Card Entry Animation (Load State)

**File**: `app/workout/[sessionId].tsx`

**Current state**: Exercise cards render without entry animation when session loads.

**Change**: Wrap each `WorkoutExerciseCard` in `FadeInDown` with staggered delay.

```tsx
// In the FlatList renderItem for exercises (around line 359-380):
import Animated, { FadeInDown } from 'react-native-reanimated';

renderItem={({ item, index }) => (
  <Animated.View
    entering={FadeInDown.delay(index * 40).duration(motion.duration.standard)}
  >
    <WorkoutExerciseCard ... />
  </Animated.View>
)}
```

**Cap stagger**: `Math.min(index * 40, 280)` to prevent late items from waiting too long.

**Verification**:
- Open workout session → cards fan in from bottom staggered
- More than 7 exercises → last card delay caps at ~280 ms, not 400+
- Reduced motion preference → no entering animation

---

## Phase 4: Navigation Consistency — History Screen

**Goal**: Make `history.tsx` match `index.tsx` and `templates.tsx` in structure and styling.

### Task 4.1 — Replace Custom Header with `AppHeader` + `Screen`

**File**: `app/(tabs)/move/history.tsx`

**Current structure** (to remove):
```tsx
// Lines 23-26 (to remove):
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const insets = useSafeAreaInsets();

// Lines 82-103 (to remove — entire custom header View):
<View style={{ paddingTop: insets.top, paddingHorizontal: spacing.xl, ... }}>
  <Pressable onPress={() => router.back()} ...>
    <Ionicons name="chevron-back" ... />
  </Pressable>
  <Text style={typography.h2}>History</Text>
</View>
```

**Replace with**:
```tsx
// New imports (keep existing, add Screen + AppHeader):
import Screen from '../../../components/ui/Screen';
import AppHeader from '../../../components/ui/AppHeader';

// Remove useSafeAreaInsets and insets.top usage entirely

// New root structure:
return (
  <Screen>
    <AppHeader title="Move" eyebrow="History" />
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
      <SegmentedControl
        options={[
          { label: 'Today', value: 'today' },
          { label: 'History', value: 'history' },
          { label: 'Templates', value: 'templates' },
        ]}
        value="history"
        onChange={(val) => {
          if (val === 'today')     router.push('/(tabs)/move');
          if (val === 'templates') router.push('/move/templates');
        }}
      />
    </View>
    <ScrollView ... />
  </Screen>
);
```

**Standardised eyebrow values across all three screens**:
| Screen | `eyebrow` | `subtitle` |
|--------|-----------|-----------|
| `index.tsx` | `format(today, 'EEEE, MMM d')` (keep dynamic date) | `"Today's workout"` |
| `history.tsx` | `"History"` | _(none)_ |
| `templates.tsx` | `"Training"` | _(none)_ (already correct) |

**Verification**:
- All three screens show identical header height and visual weight
- Back gesture (swipe from edge) works on History without custom back button
- Segmented control shows active tab highlight on all three screens
- `useSafeAreaInsets` import removed from `history.tsx`

---

## Phase 5: Verification Pass

**Run after all phases complete.**

### Functional Checks

| Check | Expected |
|-------|---------|
| Search "chicken" | Both "USDA FoodData" and "Open Food Facts" sections visible |
| Search "salmon" | USDA returns result with correct calorie value |
| Search "oreo" | Only "Open Food Facts" section (branded food) |
| One provider down (disconnect network mid-search) | Other provider's results still shown |
| Circuit breaker open state | Refresh app → USDA attempts resume |
| Add 200g chicken + 1 egg | Macro totals in bottom bar update live |
| Complete a set | Scale animation on checkmark + progress counter bumps |
| Open workout session | Exercise cards fan in with stagger |
| Navigate to History tab | Header matches Today/Templates visually |

### Grep Anti-Pattern Checks

```bash
# Should find no hardcoded hex values in modified files
grep -n '#[0-9A-Fa-f]\{6\}' app/(tabs)/log.tsx components/WorkoutSetRow.tsx \
  components/WorkoutProgressBar.tsx app/(tabs)/move/history.tsx

# Should find no Animated API usage added in modified files
grep -n "from 'react-native'" app/(tabs)/move/history.tsx | grep Animated

# Should find no useSafeAreaInsets in history.tsx
grep -n 'useSafeAreaInsets' app/(tabs)/move/history.tsx

# Should find source grouping in log.tsx (not one flat 'Open Food Facts' section)
grep -n "Open Food Facts" app/(tabs)/log.tsx  # should appear only once, inside offResults block
grep -n "USDA FoodData"  app/(tabs)/log.tsx   # should appear once, inside usdaResults block
```

---

## Execution Order

```
Phase 1 Task 1.1 → usdaFoodData.ts nutrient fallback  (isolated, no UI changes)
Phase 1 Task 1.2 → log.tsx section labels              (requires Task 1.1 to be correct first)
Phase 2 Task 2.1 → log.tsx ApiSearchRow macros         (independent of Phase 1)
Phase 2 Task 2.2 → log.tsx macro totals bar            (independent)
Phase 3 Task 3.1 → WorkoutSetRow scale                 (independent)
Phase 3 Task 3.2 → WorkoutProgressBar counter          (independent)
Phase 3 Task 3.3 → sessionId.tsx stagger               (independent)
Phase 4 Task 4.1 → history.tsx header                  (independent)
Phase 5          → verification pass                   (last)
```

Phases 2, 3, and 4 can be executed in parallel by separate agents after Phase 1 completes.
