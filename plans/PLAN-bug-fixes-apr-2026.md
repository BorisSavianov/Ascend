# Bug Fix Plan — April 2026

Seven issues reported across Log, Move, Profile, and Notifications.

---

## Phase 0: Documentation Discovery

No external library changes needed — all fixes use APIs already in the codebase
(react-native-reanimated, expo-notifications, expo-router, expo-file-system).

**Allowed patterns (already in codebase):**
- `KeyboardAvoidingView` from `react-native` — used elsewhere in the app
- `router.replace(path)` from `expo-router` — already imported in workout screen
- `response.text()` from native Fetch API — standard, no import needed
- `FadeInDown`, `withSpring`, `withTiming` from `react-native-reanimated` — already in move screens
- `Notifications.SchedulableTriggerInputTypes.DAILY` — already used in `lib/notifications.ts`

---

## Phase 1 — Log Meal: Keyboard Auto-Focus + Layout Push

**What to fix:**

### 1a. Keyboard auto-opens on Log screen mount

**File:** `app/(tabs)/log.tsx:72-77`

Remove the entire `useEffect` block that calls `searchInputRef.current?.focus()`:

```typescript
// DELETE this entire block:
useEffect(() => {
  const timer = setTimeout(() => {
    searchInputRef.current?.focus();
  }, 300);
  return () => clearTimeout(timer);
}, []);
```

The keyboard should only open when the user explicitly taps the search field.

---

### 1b. Current total pushed off-screen when keyboard appears during food search

**Context:** `app/(tabs)/log.tsx` renders:
```
<Screen>           ← SafeAreaView, no keyboard avoidance
  <View flex:1>
    <AppHeader />
    <View flex:1>
      <TextField />        ← triggers keyboard
      <FlatList />         ← search results
    </View>
  </View>
  <BottomActionBar />     ← "Current total" + "Log meal" button
</Screen>
```
When the keyboard appears, `BottomActionBar` stays at the bottom of the screen and gets covered — there's no `KeyboardAvoidingView` to push it up.

**Fix:** Wrap `log.tsx`'s root `<View style={{ flex: 1 }}>` (and the `BottomActionBar`) inside a `KeyboardAvoidingView`:

```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

// Replace the outer <View style={{ flex: 1 }}> with:
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  {/* existing content unchanged */}
  <BottomActionBar>...</BottomActionBar>
</KeyboardAvoidingView>
```

This sits _inside_ `<Screen>` (which owns `SafeAreaView`), so safe area insets still apply correctly.

**Verification:**
- Open Log screen → keyboard should NOT open automatically
- Tap food search field → keyboard opens, BottomActionBar scrolls up into view above it
- Pill nav (tab bar) is already hidden on this screen so the space is available

---

## Phase 2 — Move Page: Subtab Date Consistency + Animations

### 2a. Date shown only on Today subtab

**Files:**
- `app/(tabs)/move/index.tsx:228-231` — Today tab (has date eyebrow ✓)
- `app/(tabs)/move/history.tsx:79-80` — History tab (eyebrow = "History", no date)
- `app/(tabs)/move/templates.tsx` — Templates tab (no eyebrow)

**Fix:** Give all three subtabs a consistent `AppHeader` structure:
- Today: `eyebrow={format(today, 'EEEE, d MMMM')}` subtitle="Today's workout" ← keep as-is
- History: `eyebrow={format(today, 'EEEE, d MMMM')}` subtitle="Workout history"
- Templates: `eyebrow={format(today, 'EEEE, d MMMM')}` subtitle="Templates"

Import `format` from `date-fns` and `new Date()` in both history.tsx and templates.tsx (same pattern as index.tsx line 230).

---

### 2b. Move page needs more animations and fluidity

**Current state:** index.tsx uses `FadeInDown.duration(200/220)` + `FadeOutUp.duration(140)`.

**Improvements:**
1. **Workout card list — staggered entry:** Wrap each workout card in `Animated.View` with `entering={FadeInDown.delay(index * 60).duration(250).springify()}` so cards cascade in.
2. **Segmented control tab switch:** Add a short crossfade when switching between Today/History/Templates tabs — the content view should use `entering={FadeInDown.duration(180)}` on the main content container.
3. **Empty state:** Wrap the rest-day / empty-state views in `Animated.View entering={FadeIn.duration(300)}` so they don't pop in abruptly.
4. **History rows:** In `history.tsx`, add `entering={FadeInDown.delay(index * 40).duration(200)}` per row.

Reference pattern already in codebase: `app/(tabs)/move/index.tsx:268` and `448-450`.

---

## Phase 3 — Move Page: Workout Screen Back Navigation

### 3a. Exiting create/edit workout returns to Log Meal instead of Move

**Root cause:** `app/workout/[sessionId].tsx` is a route _outside_ the tabs (`/workout/[sessionId]`, not `/(tabs)/...`). After finishing, `router.back()` pops to the previously focused tab, which is Log if the user hasn't navigated explicitly.

**Fix:** Replace both `router.back()` calls in `handleBackPress` and `handleFinish` with `router.replace('/(tabs)/move')`:

```typescript
// Line 116 — early exit when no session
router.replace('/(tabs)/move');   // was: router.back()

// Line 143 — after finishing workout
router.replace('/(tabs)/move');   // was: router.back()
```

`router.replace` does not push onto the history stack, so pressing back from Move won't loop back into the workout screen.

**Verification:** Start a workout from Move → finish/exit → should land on Move tab, not Log.

---

## Phase 4 — Profile: Export `blob.text is not a function`

**Root cause:** `lib/gemini.ts:91` returns `response.blob()`. Calling `.text()` on a React Native `Blob` is not supported — `Blob.text()` is a browser Web API not polyfilled in Hermes/Expo.

**Fix (two-part):**

**Part A — `lib/gemini.ts`:** Change `triggerExport` to return `Promise<string>` and use `response.text()` directly:

```typescript
// Change return type from Promise<Blob> to Promise<string>
export async function triggerExport(
  format: "markdown" | "csv",
  days = 30
): Promise<string> {                       // ← was Promise<Blob>
  // ... auth unchanged ...
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  return response.text();                  // ← was response.blob()
}
```

**Part B — `app/(tabs)/profile.tsx:578-579`:** Remove the `blob.text()` call since we now get text directly:

```typescript
const text = await triggerExport(formatType, 30);  // ← was: const blob = await ...; const text = await blob.text()
```

Rest of the function (FileSystem.writeAsStringAsync, Sharing.shareAsync) remains unchanged.

**Verification:** Tap Export on Profile → file should share correctly with no error alert.

---

## Phase 5 — Notifications: Timing Off by ~1 Hour

**Root cause:** Two separate causes:

**Cause A — Jitter too wide:** `lib/notifications.ts:19` sets `JITTER_MINUTES = 90`. The `jitterAround` function (lines 86-89) applies a random offset of `±90 minutes` to each scheduled daily reminder. This is the direct cause of "some earlier, some later by an hour or so."

**Fix:** Reduce jitter to a sensible window:
```typescript
const JITTER_MINUTES = 15;  // was: 90
```
This gives at most ±15 min variation — enough to feel natural, not enough to confuse the user.

**Cause B — DST / timezone drift for fast reminders:** The fast reminder uses an absolute `DATE` trigger (`app/notifications.ts:329-340`). If the device crosses a DST boundary between scheduling and firing, the absolute `Date` object won't shift, so it fires at the right UTC time but the wrong local time. This is a secondary/edge-case issue.

**Fix:** For daily reminders (DAILY trigger), no change needed — Expo's DAILY trigger is local-time aware. For fast reminders (DATE trigger), ensure `triggerAt` is computed fresh at schedule time (already done) — no additional change needed unless user reports this specifically.

**Verification:**
- After change, check `Notifications.getAllScheduledNotificationsAsync()` and confirm scheduled hours are within ±15 min of configured time.
- No DST fix needed unless user confirms that's the scenario.

---

## Phase 6: Final Verification Checklist

- [ ] Log screen opens without keyboard
- [ ] Tapping food search opens keyboard; BottomActionBar ("Current total") stays visible above it
- [ ] All three Move subtabs (Today/History/Templates) show same date eyebrow format
- [ ] Workout cards/list rows animate in with stagger on Move page
- [ ] Finishing or exiting a workout returns to Move tab, not Log tab
- [ ] Profile export (MD + CSV) completes without "blob.text is not a function" error
- [ ] Scheduled daily notifications fire within ±15 min of configured time
- [ ] TypeScript: `tsc --noEmit` passes with no new errors (especially `triggerExport` callers)

---

## Anti-Patterns to Avoid

- Do NOT add a `keyboardShouldPersistTaps` workaround on the FlatList as a substitute for `KeyboardAvoidingView` — it won't fix the BottomActionBar being hidden
- Do NOT use `router.push('/(tabs)/move')` — use `replace` to avoid stacking the Move route
- Do NOT call `blob.arrayBuffer()` + TextDecoder as an alternative — `response.text()` is simpler and already available on the Fetch Response
- Do NOT increase `JITTER_MINUTES` back above 30 without user request
