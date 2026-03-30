export const EXERCISE_PRESETS = [
  { name: "Walking",        category: "cardio",   defaultDuration: 30, kcalPerMin: 4  },
  { name: "Running",        category: "cardio",   defaultDuration: 30, kcalPerMin: 10 },
  { name: "Cycling",        category: "cardio",   defaultDuration: 45, kcalPerMin: 8  },
  { name: "Pull-ups",       category: "strength", defaultDuration: 20, kcalPerMin: 7  },
  { name: "Push-ups",       category: "strength", defaultDuration: 15, kcalPerMin: 6  },
  { name: "Weight lifting", category: "strength", defaultDuration: 45, kcalPerMin: 6  },
  { name: "Swimming",       category: "cardio",   defaultDuration: 30, kcalPerMin: 9  },
] as const;
