// components/ProactiveInsightBanner.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';
import Surface from './ui/Surface';
import Button from './ui/Button';
import { colors, spacing, typography } from '../lib/theme';
import type { AiProactiveInsightRow } from '../types/database';

type Props = {
  insight: AiProactiveInsightRow;
  onDismiss: () => void;
  onAskAboutThis: (question: string) => void;
};

export default function ProactiveInsightBanner({ insight, onDismiss, onAskAboutThis }: Props) {
  function handleDismiss() {
    // Dismiss immediately (optimistic). Fire-and-forget the DB write so a network
    // failure doesn't leave the banner in a broken state. The cancelled flag in
    // useProactiveInsight suppresses re-showing the insight in the same focus session.
    void supabase.from('ai_proactive_insights').update({ read: true }).eq('id', insight.id);
    onDismiss();
  }

  function handleAsk() {
    // Mark as read in Supabase (same as dismiss — prevents banner reappearing on next focus)
    void supabase.from('ai_proactive_insights').update({ read: true }).eq('id', insight.id);
    onDismiss();
    const preview = insight.content.slice(0, 120);
    onAskAboutThis(`Tell me more about this observation: ${preview}`);
  }

  return (
    <Surface
      style={{
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        borderColor: colors.accent.primary,
        backgroundColor: colors.accent.primaryMuted,
      }}
    >
      <Text
        style={[typography.caption, { color: colors.accent.primary, marginBottom: spacing.xs }]}
      >
        Weekly insight
      </Text>
      <Text
        style={[typography.bodySm, { color: colors.text.primary, marginBottom: spacing.md }]}
        numberOfLines={3}
      >
        {insight.content}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Button
          label="Ask about this"
          onPress={handleAsk}
          variant="secondary"
          size="md"
          style={{ flex: 1 }}
        />
        <Pressable onPress={() => { void handleDismiss(); }} style={{ paddingHorizontal: spacing.sm }}>
          <Text style={[typography.bodySm, { color: colors.text.secondary }]}>Dismiss</Text>
        </Pressable>
      </View>
    </Surface>
  );
}
