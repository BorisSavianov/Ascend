import { OpenFoodFactsAPI } from '../lib/nutritionApi/openFoodFacts';

const MOCK_PRODUCT = {
  code: '1234567890',
  product_name: 'Chicken Breast',
  brands: 'Generic',
  image_front_small_url: 'https://images.openfoodfacts.org/images/products/chicken.jpg',
  nutriments: {
    'energy-kcal_100g': 165,
    proteins_100g: 31,
    fat_100g: 3.6,
    carbohydrates_100g: 0,
    fiber_100g: 0,
  },
};

global.fetch = jest.fn();

describe('OpenFoodFactsAPI.search', () => {
  const api = new OpenFoodFactsAPI();

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('maps a valid product to NutritionSearchResult', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: [MOCK_PRODUCT] }),
    });

    const results = await api.search('chicken');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      externalId: '1234567890',
      name: 'Chicken Breast',
      brand: 'Generic',
      imageUrl: 'https://images.openfoodfacts.org/images/products/chicken.jpg',
      caloriesPer100g: 165,
      proteinPer100g: 31,
      fatPer100g: 3.6,
      carbsPer100g: 0,
      fiberPer100g: 0,
      source: 'openfoodfacts',
    });
  });

  it('filters out products missing name', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [{ code: 'abc', nutriments: { 'energy-kcal_100g': 100 } }],
      }),
    });

    const results = await api.search('test');
    expect(results).toHaveLength(0);
  });

  it('filters out products missing calories', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [{ code: 'def', product_name: 'Something', nutriments: {} }],
      }),
    });

    const results = await api.search('test');
    expect(results).toHaveLength(0);
  });

  it('filters out products missing code', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          { product_name: 'No code', nutriments: { 'energy-kcal_100g': 100 } },
        ],
      }),
    });

    const results = await api.search('test');
    expect(results).toHaveLength(0);
  });

  it('rounds nutrition values to 1 decimal place', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            code: 'x',
            product_name: 'Test',
            nutriments: {
              'energy-kcal_100g': 123.456,
              proteins_100g: 10.333,
              fat_100g: 0,
              carbohydrates_100g: 0,
              fiber_100g: 0,
            },
          },
        ],
      }),
    });

    const results = await api.search('test');
    expect(results[0].caloriesPer100g).toBe(123.5);
    expect(results[0].proteinPer100g).toBe(10.3);
  });

  it('throws on non-ok response', async () => {
    // Mock all retry attempts to return 503 so the loop exhausts
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
    jest.useFakeTimers();

    const searchPromise = api.search('test');
    // Attach the rejection handler BEFORE advancing timers to avoid
    // PromiseRejectionHandledWarning from unhandled async rejection
    const expectation = expect(searchPromise).rejects.toThrow('OpenFoodFacts search failed: 503');

    // Advance through all exponential backoff delays (1s + 2s)
    await jest.runAllTimersAsync();
    jest.useRealTimers();

    await expectation;
  });

  it('returns empty array when products array is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: [] }),
    });

    const results = await api.search('nothing');
    expect(results).toHaveLength(0);
  });
});
