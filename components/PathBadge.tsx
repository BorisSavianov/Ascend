// components/PathBadge.tsx
import React from 'react';
import { Text } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

export default function PathBadge() {
  return (
    <Text
      style={[
        typography.caption,
        {
          color: colors.text.tertiary,
          marginTop: spacing.xs,
          marginHorizontal: spacing.xl,
          marginBottom: spacing.sm,
        },
      ]}
    >
      · reasoned with tools
    </Text>
  );
}
