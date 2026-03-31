import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import Surface from './ui/Surface';

type Props = {
  message: string;
  title?: string;
};

export default function EmptyState({ message, title = 'Nothing here yet' }: Props) {
  return (
    <Surface
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing['3xl'],
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.accent.primaryMuted,
          borderWidth: 1,
          borderColor: colors.accent.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Ionicons name="sparkles-outline" size={22} color={colors.accent.primary} />
      </View>
      <Text style={typography.h3}>{title}</Text>
      <Text
        style={[
          typography.bodySm,
          {
            textAlign: 'center',
            marginTop: spacing.sm,
            maxWidth: 260,
          },
        ]}
      >
        {message}
      </Text>
    </Surface>
  );
}
