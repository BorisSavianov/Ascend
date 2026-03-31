import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../../lib/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  elevated?: boolean;
  overlay?: boolean;
};

export default function Surface({
  children,
  style,
  padding = 'xl',
  elevated = false,
  overlay = false,
}: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: overlay
            ? colors.bg.surfaceOverlay
            : elevated
              ? colors.bg.surfaceRaised
              : colors.bg.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: elevated ? colors.border.default : colors.border.subtle,
          padding: spacing[padding],
        },
        elevated ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

