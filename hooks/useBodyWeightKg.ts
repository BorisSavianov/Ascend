import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEFAULT_BODY_WEIGHT_KG } from '../lib/calorieEstimator';

/**
 * Returns the user's most recent logged body weight in kg.
 * Falls back to DEFAULT_BODY_WEIGHT_KG (75 kg) if no data is available.
 */
export function useBodyWeightKg(): number {
  const { data } = useQuery({
    queryKey: ['body_weight_latest'],
    queryFn: async () => {
      const { data: row } = await supabase
        .from('body_metrics')
        .select('weight_kg')
        .not('weight_kg', 'is', null)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return row?.weight_kg ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  return data ?? DEFAULT_BODY_WEIGHT_KG;
}
