import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type SetInputState = {
  weight: string;      // raw text for the weight input, e.g. "45.5"
  reps: string;        // raw text for the reps input, e.g. "12"
  rpe: string;         // raw text for RPE input, optional, e.g. "8"
  isCompleted: boolean;
  isSaving: boolean;   // true while the optimistic mutation is in-flight
};

type WorkoutStore = {
  // ── Session lifecycle ──────────────────────────────────────────────────────
  activeSessionId: string | null;
  activePresetId: string | null;
  sessionStartedAt: string | null; // ISO string
  pausedAt: string | null;         // ISO string, non-null when paused
  pausedDurationMs: number;        // accumulated pause time in ms

  // ── Per-set input state ────────────────────────────────────────────────────
  // Key: loggedExerciseId → array indexed by (set_number - 1)
  setInputs: Record<string, SetInputState[]>;

  // ── UI state (NOT persisted) ───────────────────────────────────────────────
  collapsedExerciseIds: Set<string>;

  // ── Actions ───────────────────────────────────────────────────────────────
  startSession: (sessionId: string, presetId: string | null) => void;
  endSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;

  /**
   * Initialise the set input rows for a given logged exercise.
   * Idempotent: if the exercise already has `targetSets` rows, this is a no-op
   * (prevents resetting user-entered values on re-render).
   * Pre-fills weight and reps from the previous session when provided.
   */
  initExerciseSets: (
    loggedExerciseId: string,
    targetSets: number,
    previousSets: Array<{ weight_kg: number | null; reps: number | null }> | null,
  ) => void;

  updateSetInput: (
    loggedExerciseId: string,
    setIndex: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => void;

  markSetSaving: (loggedExerciseId: string, setIndex: number, saving: boolean) => void;
  markSetCompleted: (loggedExerciseId: string, setIndex: number, completed: boolean) => void;

  toggleExerciseCollapsed: (loggedExerciseId: string) => void;

  addSetInput: (loggedExerciseId: string, prefillFromLast: boolean) => void;
  removeSetInput: (loggedExerciseId: string, setIndex: number) => void;

  resetSession: () => void;
};

type PersistedWorkoutState = {
  activeSessionId: string | null;
  activePresetId: string | null;
  sessionStartedAt: string | null;
  pausedAt: string | null;
  pausedDurationMs: number;
  setInputs: Record<string, SetInputState[]>;
};

function makeEmptySet(): SetInputState {
  return { weight: '', reps: '', rpe: '', isCompleted: false, isSaving: false };
}

function makeDefaultSet(prevWeight: number | null, prevReps: number | null): SetInputState {
  return {
    weight: prevWeight != null ? String(prevWeight) : '',
    reps: prevReps != null ? String(prevReps) : '',
    rpe: '',
    isCompleted: false,
    isSaving: false,
  };
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist<WorkoutStore, PersistedWorkoutState>(
    (set, get) => ({
      activeSessionId: null,
      activePresetId: null,
      sessionStartedAt: null,
      pausedAt: null,
      pausedDurationMs: 0,
      setInputs: {},
      collapsedExerciseIds: new Set(),

      startSession: (sessionId, presetId) =>
        set({
          activeSessionId: sessionId,
          activePresetId: presetId,
          sessionStartedAt: new Date().toISOString(),
          pausedAt: null,
          pausedDurationMs: 0,
          setInputs: {},
          collapsedExerciseIds: new Set(),
        }),

      endSession: () =>
        set({
          activeSessionId: null,
          activePresetId: null,
          sessionStartedAt: null,
          pausedAt: null,
          pausedDurationMs: 0,
        }),

      pauseSession: () => set({ pausedAt: new Date().toISOString() }),

      resumeSession: () =>
        set((state) => ({
          pausedDurationMs:
            state.pausedDurationMs +
            (state.pausedAt ? Date.now() - Date.parse(state.pausedAt) : 0),
          pausedAt: null,
        })),

      initExerciseSets: (loggedExerciseId, targetSets, previousSets) => {
        const current = get().setInputs[loggedExerciseId];
        // Idempotency: already initialised with the right number of sets → skip
        if (current && current.length >= targetSets) return;

        const rows: SetInputState[] = Array.from({ length: targetSets }, (_, i) => {
          const prev = previousSets?.[i] ?? null;
          return makeDefaultSet(prev?.weight_kg ?? null, prev?.reps ?? null);
        });

        set((state) => ({
          setInputs: { ...state.setInputs, [loggedExerciseId]: rows },
        }));
      },

      updateSetInput: (loggedExerciseId, setIndex, field, value) =>
        set((state) => {
          const existing = state.setInputs[loggedExerciseId] ?? [];
          const updated = existing.map((s, i) =>
            i === setIndex ? { ...s, [field]: value } : s,
          );
          return { setInputs: { ...state.setInputs, [loggedExerciseId]: updated } };
        }),

      markSetSaving: (loggedExerciseId, setIndex, saving) =>
        set((state) => {
          const existing = state.setInputs[loggedExerciseId] ?? [];
          const updated = existing.map((s, i) =>
            i === setIndex ? { ...s, isSaving: saving } : s,
          );
          return { setInputs: { ...state.setInputs, [loggedExerciseId]: updated } };
        }),

      markSetCompleted: (loggedExerciseId, setIndex, completed) =>
        set((state) => {
          const existing = state.setInputs[loggedExerciseId] ?? [];
          const updated = existing.map((s, i) =>
            i === setIndex ? { ...s, isCompleted: completed } : s,
          );
          return { setInputs: { ...state.setInputs, [loggedExerciseId]: updated } };
        }),

      toggleExerciseCollapsed: (loggedExerciseId) =>
        set((state) => {
          const next = new Set(state.collapsedExerciseIds);
          if (next.has(loggedExerciseId)) {
            next.delete(loggedExerciseId);
          } else {
            next.add(loggedExerciseId);
          }
          return { collapsedExerciseIds: next };
        }),

      addSetInput: (loggedExerciseId, prefillFromLast) =>
        set((state) => {
          const existing = state.setInputs[loggedExerciseId] ?? [];
          const last = existing[existing.length - 1];
          const newSet: SetInputState =
            prefillFromLast && last
              ? { ...makeEmptySet(), weight: last.weight, reps: last.reps }
              : makeEmptySet();
          return {
            setInputs: {
              ...state.setInputs,
              [loggedExerciseId]: [...existing, newSet],
            },
          };
        }),

      removeSetInput: (loggedExerciseId, setIndex) =>
        set((state) => {
          const existing = state.setInputs[loggedExerciseId] ?? [];
          const updated = existing.filter((_, i) => i !== setIndex);
          return {
            setInputs: { ...state.setInputs, [loggedExerciseId]: updated },
          };
        }),

      resetSession: () =>
        set({
          activeSessionId: null,
          activePresetId: null,
          sessionStartedAt: null,
          pausedAt: null,
          pausedDurationMs: 0,
          setInputs: {},
          collapsedExerciseIds: new Set(),
        }),
    }),
    {
      name: 'workout-store',
      storage: createJSONStorage(() => AsyncStorage as unknown as Storage),
      partialize: (state): PersistedWorkoutState => ({
        activeSessionId: state.activeSessionId,
        activePresetId: state.activePresetId,
        sessionStartedAt: state.sessionStartedAt,
        pausedAt: state.pausedAt,
        pausedDurationMs: state.pausedDurationMs,
        setInputs: state.setInputs,
      }),
    },
  ),
);
