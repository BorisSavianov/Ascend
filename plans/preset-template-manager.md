# Preset Template Manager — Implementation Plan

## Context

The `feature/move-overhaul` branch ships a full backend for workout presets but has no UI to manage them. The move page shows today's seeded workout and a "presets manager" link that goes nowhere. This plan implements the missing spec: view all templates, fully edit any of them, and assign them to days.

---

## Phase 0: Discovery (COMPLETE)

### Confirmed APIs — all hooks exist, no migration needed

| Hook | Signature | Query key |
|------|-----------|-----------|
| `useWorkoutPresets()` | `→ WorkoutPreset[]` | `['workout_presets']` |
| `useCreatePreset()` | `mutate({ name })` | invalidates `workout_presets` |
| `useUpdatePreset()` | `mutate({ id, name })` | invalidates `workout_presets` |
| `useDeletePreset()` | `mutate({ id })` | invalidates `workout_presets` |
| `usePresetExercises(presetId)` | `→ WorkoutPresetExercise[]` | `['preset_exercises', presetId]` |
| `useAddPresetExercise()` | `mutate({ presetId, exerciseTemplateId, sortOrder, defaultSets?, defaultRepsMin?, defaultRepsMax? })` | invalidates `preset_exercises` |
| `useRemovePresetExercise()` | `mutate({ id, presetId })` | invalidates `preset_exercises` |
| `useWeekAssignments()` | `→ WeekAssignment[]` (day_of_week 0–6, preset: {id,name}\|null) | `['week_assignments']` |
| `useUpsertDayAssignment()` | `mutate({ dayOfWeek, presetId: string\|null })` | invalidates `week_assignments`, `day_assignment` |

### Key types (types/workout.ts)
```
WorkoutPreset         { id, user_id, name, created_at, updated_at }
WorkoutPresetExercise { id, preset_id, exercise_template_id, sort_order,
                        default_sets, default_reps_min, default_reps_max,
                        default_weight_kg, exercise_template: ExerciseTemplate }
ExerciseTemplate      { id, name, muscle_group, equipment, image_key,
                        target_sets, target_reps_min, target_reps_max }
```

### UI patterns to copy
- Theme tokens: `colors`, `spacing`, `typography`, `radius`, `fontFamily` from `lib/theme`
- Screen wrapper: `<Screen scroll>` + `<AppHeader title=… eyebrow=… />`
- Cards: `<Surface>` component
- Buttons: `<Button label=… variant="primary"|"secondary"|"destructive" />`
- Input: `<TextField label=… value=… onChangeText=… />`
- Bottom sheet modal: animate translateY + opacity (copy pattern from `components/ui/ConfirmationSheet.tsx`)
- Undo toast: `<UndoToast>` with 5000 ms delay (UNDO_DELAY_MS pattern from `move/index.tsx:51`)
- Navigation: `router.push()` / `router.back()` from `expo-router`
- SegmentedControl: `<SegmentedControl options={[…]} value=… onChange=… />`

### Missing hooks (must create in Phase 1)
1. **`hooks/useUpdatePresetExercise.ts`** — no UPDATE hook for changing default sets/reps on an existing `workout_preset_exercises` row
2. **`hooks/useExerciseTemplates.ts`** — no hook to fetch `exercise_templates` table (needed for the exercise picker)

### Files to create
- `hooks/useUpdatePresetExercise.ts`
- `hooks/useExerciseTemplates.ts`
- `app/(tabs)/move/templates.tsx`
- `app/preset/[presetId].tsx`
- `components/ExercisePickerSheet.tsx`

### Files to modify
- `app/(tabs)/move/index.tsx` — add "Templates" segment + wire unseeded link
- `app/(tabs)/move/history.tsx` — add "Templates" to its SegmentedControl

---

## Phase 1: Missing Hooks

### Task 1.1 — `hooks/useUpdatePresetExercise.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type UpdatePresetExerciseVars = {
  id: string;
  presetId: string;
  defaultSets: number;
  defaultRepsMin: number;
  defaultRepsMax: number;
  defaultWeightKg?: number | null;
};

export function useUpdatePresetExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, defaultSets, defaultRepsMin, defaultRepsMax, defaultWeightKg }: UpdatePresetExerciseVars) => {
      const { error } = await supabase
        .from('workout_preset_exercises')
        .update({
          default_sets: defaultSets,
          default_reps_min: defaultRepsMin,
          default_reps_max: defaultRepsMax,
          default_weight_kg: defaultWeightKg ?? null,
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { presetId }) => {
      void queryClient.invalidateQueries({ queryKey: ['preset_exercises', presetId] });
    },
  });
}
```

### Task 1.2 — `hooks/useExerciseTemplates.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ExerciseTemplate } from '../types/workout';

export function useExerciseTemplates() {
  return useQuery({
    queryKey: ['exercise_templates'],
    queryFn: async (): Promise<ExerciseTemplate[]> => {
      const { data, error } = await supabase
        .from('exercise_templates')
        .select('*')
        .order('muscle_group', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ExerciseTemplate[];
    },
    staleTime: 30 * 60 * 1000,
  });
}
```

### Verification
- `npx tsc --noEmit` passes clean
- Both hooks importable without error

---

## Phase 2: Templates List Screen

**File:** `app/(tabs)/move/templates.tsx`

The screen is the third destination in the Move SegmentedControl. It has two sections:

### Section A — "Your Week" (day planner)
- Render a horizontal row of 7 day cells: **Su Mo Tu We Th Fr Sa** (day_of_week 0–6)
- Each cell is a `Pressable` showing:
  - Day abbreviation (top, muted)
  - Preset name truncated to ~8 chars, or "Rest" if `preset_id` is null
- Use `useWeekAssignments()` (returns sorted 0–6)
- Tap a day cell → opens a local assignment sheet (see below)

**Assignment sheet (inline Modal, same pattern as ConfirmationSheet):**
- Title: e.g. "Monday"
- List of all `presets` (from `useWorkoutPresets()`) as pressable rows
- One "Rest day" row at the top
- Tap any row → `useUpsertDayAssignment().mutate({ dayOfWeek, presetId })` → dismiss

### Section B — "Workouts" (preset list)
- One `Surface` card per preset:
  - Left: preset name (bold) + subtitle "N exercises"
  - Right: chevron-right icon
  - Tap → `router.push('/preset/' + preset.id)`
- Show a skeleton row while `useWorkoutPresets()` is loading

### Footer
- `<Button label="New Workout" variant="secondary" />` at bottom
- Tap → local `useState` shows an inline name-input sheet → on submit: `useCreatePreset().mutate({ name })` → on success navigate to `/preset/[newId]`
  - Get new id from `useMutation` `onSuccess` data: `supabase` insert returns the created row; use `select()` in `useCreatePreset` — **check current implementation first**, add `.select().single()` if it doesn't return data already

### Hooks used
```
useWeekAssignments()
useWorkoutPresets()
useUpsertDayAssignment()
useCreatePreset()
```

### Verification checklist
- [ ] 7 day cells render with correct preset names from seed data
- [ ] Tap Wednesday → "Full Body Machine" highlighted in sheet
- [ ] Change assignment → cell updates immediately (optimistic or invalidation)
- [ ] Preset cards show correct exercise counts (note: exercise count requires joining — check if `useWorkoutPresets` returns count or if it needs a separate query; if count not available, omit subtitle or add it to the query)
- [ ] Tap preset card → navigates to `/preset/[id]`
- [ ] "+ New Workout" flow creates a preset and lands on editor

---

## Phase 3: Preset Editor Screen

**File:** `app/preset/[presetId].tsx`

Entry point: `const { presetId } = useLocalSearchParams<{ presetId: string }>()` (expo-router pattern)

### Header area
- Back button (chevron-left → `router.back()`)
- Editable preset name: `<TextField>` pre-filled with `preset.name`
- Save name: call `useUpdatePreset().mutate({ id: presetId, name })` on blur
- Show `useWorkoutPresets()` data to get current name — or derive from `usePresetExercises` which returns `preset_id`

Actually: fetch preset name separately. Add a small `usePreset(id)` inline query or use the cached `workout_presets` list (already in TanStack cache from templates screen visit). Use `useQueryClient().getQueryData(['workout_presets'])` to read cache without extra fetch, or just do a simple `useQuery` with `queryKey: ['workout_preset', presetId]`.

For simplicity: pass name as a route param via Expo Router `params` when navigating from templates screen (e.g. `router.push({ pathname: '/preset/[presetId]', params: { presetId: id, name: preset.name } })`). Display it immediately from params, then sync with `useUpdatePreset` on blur.

### Exercise list
Source: `usePresetExercises(presetId)` → `WorkoutPresetExercise[]` sorted by `sort_order`

Each exercise row (collapsed by default):
```
┌─────────────────────────────────┐
│ [Lat Pulldown]    2 × 10–12   ✕ │
└─────────────────────────────────┘
```
Tap row → expand inline:
```
┌─────────────────────────────────┐
│ [Lat Pulldown]    2 × 10–12   ✕ │
│ ─────────────────────────────── │
│ Sets       [ 2 ]                │
│ Reps min   [10 ]                │
│ Reps max   [12 ]                │
│ Weight kg  [   ] (optional)     │
└─────────────────────────────────┘
```
- Numeric inputs (keyboardType="numeric")
- Save each field: on `onEndEditing` or blur call `useUpdatePresetExercise().mutate({ id, presetId, defaultSets, defaultRepsMin, defaultRepsMax, defaultWeightKg })`
- Use local `useState` for input values (initialised from the exercise row data)

Remove exercise:
- ✕ tapped → undo toast starts (5000 ms) → on timeout: `useRemovePresetExercise().mutate({ id, presetId })` 
- Undo pressed → cancel timeout, clear toast

### Footer
- `<Button label="Add Exercise" variant="secondary" />` → sets `showPicker = true` state
- `<ExercisePickerSheet visible={showPicker} presetId={presetId} currentCount={exercises.length} onClose={() => setShowPicker(false)} />`
- `<Button label="Delete Workout" variant="destructive" />` → sets `showDeleteConfirm = true`
- `<ConfirmationSheet visible={showDeleteConfirm} title="Delete workout?" confirmLabel="Delete" tone="danger" onConfirm={() => { useDeletePreset().mutate({ id: presetId }); router.back(); }} onCancel={...} />`

### Hooks used
```
usePresetExercises(presetId)
useUpdatePreset()
useUpdatePresetExercise()
useRemovePresetExercise()
useAddPresetExercise()   ← via ExercisePickerSheet
useDeletePreset()
```

### Verification checklist
- [ ] Preset name editable, persists on navigate away + return
- [ ] All seeded exercises visible with correct sets × reps
- [ ] Expand row → inputs show correct values
- [ ] Change sets → save → collapse → re-expand shows new value
- [ ] Remove exercise with undo: row disappears, undo restores it, without undo it's gone after 5s
- [ ] Add exercise via picker → appears at bottom of list
- [ ] Delete preset → navigates back, preset gone from templates screen

---

## Phase 4: Exercise Picker Sheet

**File:** `components/ExercisePickerSheet.tsx`

```typescript
type Props = {
  visible: boolean;
  presetId: string;
  currentCount: number;          // used as initial sort_order for new exercise
  onClose: () => void;
};
```

### Layout (Modal bottom sheet, pattern from ConfirmationSheet)
```
Backdrop (Pressable, onPress → onClose)
├── Sheet (animated translateY)
│   ├── Handle bar (42×4, pill, border.strong)
│   ├── Title "Add Exercise"
│   ├── TextField placeholder="Search…" value={search} onChangeText={setSearch}
│   └── ScrollView
│       └── [grouped by muscle_group]
│           ├── Section header (muscle_group uppercase)
│           └── Pressable rows (exercise name + equipment)
```

### Logic
- `useExerciseTemplates()` → full list
- Client-side filter: `templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))`
- When search is empty: group by `muscle_group`, show sections
- When search is active: flat filtered list, no sections (simpler)
- Tap exercise → `useAddPresetExercise().mutate({ presetId, exerciseTemplateId: t.id, sortOrder: currentCount })` → dismiss sheet (`onClose()`)
- Already-added exercises (cross-reference with `usePresetExercises(presetId)`) show a checkmark and are non-pressable

### Verification checklist
- [ ] All exercise_templates render
- [ ] Search filters correctly
- [ ] Tap adds exercise and closes sheet
- [ ] Re-open sheet — added exercise shows checkmark

---

## Phase 5: Navigation Wiring

### `app/(tabs)/move/index.tsx`

**Change 1:** SegmentedControl (lines ~237–246) — add third option:
```typescript
options={[
  { label: 'Today', value: 'today' },
  { label: 'History', value: 'history' },
  { label: 'Templates', value: 'templates' },
]}
onChange={(v) => {
  if (v === 'history') router.push('/move/history');
  if (v === 'templates') router.push('/move/templates');
}}
```

**Change 2:** Unseeded state text (line ~272) — replace "presets manager" mention with a tappable link:
```typescript
// Change the Button or add a TextLink that calls router.push('/move/templates')
```

### `app/(tabs)/move/history.tsx`

Same SegmentedControl change as above (add Templates option, value="history" stays).

### `app/(tabs)/move/templates.tsx`

SegmentedControl with value="templates", onChange pushes to history or pops back to index.

### Verification checklist
- [ ] Tapping "Templates" from Today view navigates to templates screen
- [ ] Tapping "Today" from templates navigates back (use `router.back()` or `router.push('/move/')`)
- [ ] Unseeded "set up" banner links to templates screen
- [ ] History screen also has Templates in its SegmentedControl

---

## Phase 6: Final Verification

Run after all phases complete.

1. **TypeScript:** `npx tsc --noEmit` — zero errors
2. **Navigation smoke test:**
   - Today → Templates → tap preset → edit name → back → name updated in list
   - Templates → week grid → change day assignment → day cell updates
   - Templates → "New Workout" → name entry → creates + navigates to editor
3. **Edit persistence:** Edit sets/reps → kill app → reopen → values retained (DB-backed, not local state)
4. **Delete cascade:** Delete "Full Body Machine" → Wednesday day cell shows "Rest"
5. **Undo flows:** Remove exercise, wait 4s → undo → exercise restored. Wait 6s → gone.
6. **Exercise picker search:** Type "lat" → only Lat Pulldown shows. Clear → full grouped list.
7. **No regressions:** Today workout view still shows correct preset + start button. History screen still loads.

---

## Anti-Patterns to Avoid

- Do NOT invent new Supabase RPC calls — all operations go through the existing hooks
- Do NOT use `exercise_templates` table column names beyond what `ExerciseTemplate` type declares
- Do NOT add `reorder` (drag-to-reorder) — not in scope; `sort_order` is set at add time only
- Do NOT add `default_weight_kg` as a required field — it's `number | null`, input is optional
- Do NOT create a new layout file for `/preset/` — Expo Router auto-registers `app/preset/[presetId].tsx` under the root Stack
