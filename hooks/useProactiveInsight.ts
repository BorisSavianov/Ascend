// hooks/useProactiveInsight.ts
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { AiProactiveInsightRow } from '../types/database';

export function useProactiveInsight() {
  const [insight, setInsight] = useState<AiProactiveInsightRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      void fetchLatestInsight();
    }, []),
  );

  async function fetchLatestInsight() {
    const { data } = await supabase
      .from('ai_proactive_insights')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setInsight(data ?? null);
  }

  function dismiss() {
    setInsight(null);
  }

  return { insight, dismiss };
}
