import { z } from 'zod';

export const MealItemInputSchema = z
  .object({
    foodId: z.string().uuid().nullable(),
    foodName: z.string().min(1),
    amountG: z.number().positive().optional(),
    portionDesc: z.string().min(1).optional(),
    calories: z.number().min(0),
    proteinG: z.number().min(0),
    fatG: z.number().min(0),
    carbsG: z.number().min(0),
    fiberG: z.number().min(0),
  })
  .refine(
    (d: { amountG?: number; portionDesc?: string }) =>
      d.amountG !== undefined || d.portionDesc !== undefined,
    { message: 'Either amountG or portionDesc must be provided' },
  );

export const LogMealInputSchema = z.object({
  mealIndex: z.union([z.literal(1), z.literal(2)]),
  mealLabel: z.string().optional(),
  items: z.array(MealItemInputSchema).min(1),
});

export type MealItemInput = z.infer<typeof MealItemInputSchema>;
export type LogMealInput = z.infer<typeof LogMealInputSchema>;

// ── Workout module ─────────────────────────────────────────────────────────────

export const LogSetInputSchema = z.object({
  loggedExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1).max(20),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(200).nullable(),
  rpe: z
    .number()
    .min(6)
    .max(10)
    .refine((v) => v * 2 === Math.round(v * 2), { message: 'RPE must be a multiple of 0.5' })
    .nullable()
    .optional(),
  isCompleted: z.boolean(),
});

export const StartSessionInputSchema = z.object({
  presetId: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type LogSetInput = z.infer<typeof LogSetInputSchema>;
export type StartSessionInput = z.infer<typeof StartSessionInputSchema>;

export const CreatePresetInputSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreatePresetInput = z.infer<typeof CreatePresetInputSchema>;

export const UpsertDayAssignmentSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  presetId: z.string().uuid().nullable(),
});
export type UpsertDayAssignment = z.infer<typeof UpsertDayAssignmentSchema>;
