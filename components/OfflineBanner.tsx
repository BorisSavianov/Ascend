import React from 'react';
import { Text, View } from 'react-native';
import { useNetworkStatus } from '../lib/supabase';
import { colors, spacing, typography } from '../lib/theme';

export default function OfflineBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.semantic.warning,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.caption, { color: colors.bg.canvas }]}>
        You're offline. Showing cached data.
      </Text>
    </View>
  );
}
