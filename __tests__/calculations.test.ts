import {
  calculateNutrition,
  getMealIndexFromTime,
  sumNutrition,
  formatCalories,
  formatGrams,
} from '../lib/calculations';

describe('calculateNutrition', () => {
  const chicken = {
    calories_per_100g: 165,
    protein_per_100g: 31,
    fat_per_100g: 3.6,
    carbs_per_100g: 0,
    fiber_per_100g: 0,
  };

  it('calculates nutrition for 100g correctly', () => {
    const result = calculateNutrition(chicken, 100);
    expect(result.calories).toBe(165);
    expect(result.proteinG).toBe(31);
    expect(result.fatG).toBe(3.6);
    expect(result.carbsG).toBe(0);
    expect(result.fiberG).toBe(0);
  });

  it('scales correctly for 200g (double)', () => {
    const result = calculateNutrition(chicken, 200);
    expect(result.calories).toBe(330);
    expect(result.proteinG).toBe(62);
    expect(result.fatG).toBe(7.2);
  });

  it('scales correctly for 50g (half)', () => {
    const result = calculateNutrition(chicken, 50);
    expect(result.calories).toBe(82.5);
    expect(result.proteinG).toBe(15.5);
  });

  it('rounds to one decimal place', () => {
    const food = { calories_per_100g: 100, protein_per_100g: 3.333, fat_per_100g: 0, carbs_per_100g: 0, fiber_per_100g: 0 };
    const result = calculateNutrition(food, 150);
    expect(result.proteinG).toBe(5.0); // 3.333 * 1.5 = 4.9995 → rounds to 5.0
  });

  it('handles 0g amount', () => {
    const result = calculateNutrition(chicken, 0);
    expect(result.calories).toBe(0);
    expect(result.proteinG).toBe(0);
  });
});

describe('getMealIndexFromTime', () => {
  it('returns 1 for hours before 15:00', () => {
    expect(getMealIndexFromTime(new Date('2024-01-01T08:00:00'))).toBe(1);
    expect(getMealIndexFromTime(new Date('2024-01-01T14:59:00'))).toBe(1);
    expect(getMealIndexFromTime(new Date('2024-01-01T00:00:00'))).toBe(1);
  });

  it('returns 2 for hours at or after 15:00', () => {
    expect(getMealIndexFromTime(new Date('2024-01-01T15:00:00'))).toBe(2);
    expect(getMealIndexFromTime(new Date('2024-01-01T20:00:00'))).toBe(2);
    expect(getMealIndexFromTime(new Date('2024-01-01T23:59:00'))).toBe(2);
  });
});

describe('sumNutrition', () => {
  const makeItem = (calories: number, protein: number, fat: number, carbs: number, fiber: number) => ({
    id: 'x',
    meal_id: 'm',
    food_id: null,
    food_name: 'test',
    food_name_local: null,
    amount_g: 100,
    portion_desc: null,
    created_at: '',
    calories,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    fiber_g: fiber,
  });

  it('returns zeros for empty array', () => {
    const result = sumNutrition([]);
    expect(result).toEqual({ calories: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0 });
  });

  it('sums single item correctly', () => {
    const items = [makeItem(200, 30, 5, 10, 2)];
    const result = sumNutrition(items);
    expect(result.calories).toBe(200);
    expect(result.proteinG).toBe(30);
    expect(result.fatG).toBe(5);
    expect(result.carbsG).toBe(10);
    expect(result.fiberG).toBe(2);
  });

  it('sums multiple items correctly', () => {
    const items = [
      makeItem(200, 30, 5, 10, 2),
      makeItem(150, 20, 3, 8, 1),
    ];
    const result = sumNutrition(items);
    expect(result.calories).toBe(350);
    expect(result.proteinG).toBe(50);
    expect(result.fatG).toBe(8);
    expect(result.carbsG).toBe(18);
    expect(result.fiberG).toBe(3);
  });

  it('rounds totals to one decimal place', () => {
    const items = [
      makeItem(100.1, 10.1, 0, 0, 0),
      makeItem(100.1, 10.1, 0, 0, 0),
    ];
    const result = sumNutrition(items);
    expect(result.calories).toBe(200.2);
    expect(result.proteinG).toBe(20.2);
  });
});

describe('formatCalories', () => {
  it('formats whole numbers', () => {
    expect(formatCalories(1847)).toBe('1,847');
    expect(formatCalories(500)).toBe('500');
    expect(formatCalories(0)).toBe('0');
  });

  it('rounds decimals', () => {
    expect(formatCalories(1846.7)).toBe('1,847');
    expect(formatCalories(500.4)).toBe('500');
  });

  it('formats large numbers with commas', () => {
    expect(formatCalories(10000)).toBe('10,000');
  });
});

describe('formatGrams', () => {
  it('appends g suffix', () => {
    expect(formatGrams(150)).toBe('150g');
    expect(formatGrams(0)).toBe('0g');
  });

  it('rounds to whole number', () => {
    expect(formatGrams(150.7)).toBe('151g');
    expect(formatGrams(150.3)).toBe('150g');
  });
});
