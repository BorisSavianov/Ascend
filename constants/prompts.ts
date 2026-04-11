// constants/prompts.ts

export const QUICK_PROMPTS = {
  nutrition: [
    "Summarise my nutrition for the past 7 days.",
    "On which days did I miss my protein target?",
    "How has my calorie consistency looked this week?",
    "What was my average daily calorie intake this month?",
  ],
  training: [
    "What's my recent training volume trend?",
    "Am I showing progressive overload this month?",
    "Which muscle groups have I trained most this week?",
    "How many sessions did I complete in the last 14 days?",
  ],
  body_comp: [
    "How has my weight trended over the past 30 days?",
    "Is my protein intake supporting my body comp goal?",
    "Correlate my training days with my weight readings.",
    "What's my average weekly weight change over the past month?",
  ],
} as const;

export type PromptDomain = keyof typeof QUICK_PROMPTS;

/**
 * Returns the prompts for the given domain.
 * Pass the domain from component state that rotates on screen focus.
 */
export function getRotatedPrompts(domain: PromptDomain): readonly string[] {
  return QUICK_PROMPTS[domain];
}
