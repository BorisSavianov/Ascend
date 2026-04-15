/**
 * Maps common user query terms to USDA-optimized search strings.
 * Expansion targets Foundation data type (highest quality, ~1,700 foods).
 * Only applies to USDA provider — OFF and Edamam receive the original query.
 */
export const USDA_SYNONYMS: Record<string, string> = {
  // Eggs
  egg:              'egg whole raw',
  eggs:             'egg whole raw',
  // Poultry
  chicken:          'chicken breast raw',
  'chicken breast': 'chicken breast raw',
  turkey:           'turkey breast raw',
  // Beef
  beef:             'beef ground raw',
  hamburger:        'beef ground raw',
  // Pork
  pork:             'pork loin raw',
  bacon:            'pork cured bacon',
  // Fish
  salmon:           'salmon atlantic raw',
  tuna:             'tuna light canned water',
  // Dairy
  milk:             'milk whole fluid',
  yogurt:           'yogurt plain whole milk',
  cheese:           'cheese cheddar',
  butter:           'butter salted',
  // Grains
  rice:             'rice white cooked',
  oats:             'oats rolled dry',
  bread:            'bread whole wheat',
  pasta:            'pasta cooked enriched',
  // Oils
  oil:              'olive oil salad or cooking',
  'olive oil':      'olive oil salad or cooking',
  // Produce
  banana:           'bananas raw',
  apple:            'apples raw',
  potato:           'potato baked flesh and skin',
  broccoli:         'broccoli raw',
  spinach:          'spinach raw',
  // Legumes
  beans:            'beans kidney cooked boiled',
  lentils:          'lentils cooked boiled',
};

/**
 * Expands a user query for USDA search.
 * Returns the synonym expansion if found; otherwise the original query unchanged.
 */
export function expandForUSDA(query: string): string {
  return USDA_SYNONYMS[query.toLowerCase().trim()] ?? query;
}
