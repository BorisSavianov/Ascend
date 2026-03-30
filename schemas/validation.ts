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
