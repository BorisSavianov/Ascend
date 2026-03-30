export type PortionPreset = {
  label: string;
  grams: number;
};

export const PORTION_PRESETS: PortionPreset[] = [
  { label: '50g', grams: 50 },
  { label: '100g', grams: 100 },
  { label: '150g', grams: 150 },
  { label: '200g', grams: 200 },
  { label: '250g', grams: 250 },
  { label: '300g', grams: 300 },
];

export const DEFAULT_AMOUNT_G = 100;
