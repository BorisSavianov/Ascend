export const DEFAULT_BODY_WEIGHT_KG = 75;

/**
 * MET-based calorie estimate.
 * Formula: MET × bodyWeight(kg) × duration(hours)
 *
 * Example: Walking 30 min → 3.5 × 75 × 0.5 = 131 kcal
 */
export function estimateCalories(
  met: number,
  durationMin: number,
  bodyWeightKg: number = DEFAULT_BODY_WEIGHT_KG,
): number {
  return Math.round(met * bodyWeightKg * (durationMin / 60));
}
