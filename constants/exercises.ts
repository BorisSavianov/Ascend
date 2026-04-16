export const EXERCISE_PRESETS = [
  { name: "Walking",        category: "cardio",   defaultDuration: 30, met: 3.5 },
  { name: "Running",        category: "cardio",   defaultDuration: 30, met: 8.0 },
  { name: "Cycling",        category: "cardio",   defaultDuration: 45, met: 6.0 },
  { name: "Pull-ups",       category: "strength", defaultDuration: 20, met: 5.5 },
  { name: "Push-ups",       category: "strength", defaultDuration: 15, met: 4.0 },
  { name: "Weight lifting", category: "strength", defaultDuration: 45, met: 4.5 },
  { name: "Swimming",       category: "cardio",   defaultDuration: 30, met: 7.0 },
] as const;
