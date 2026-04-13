import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../../lib/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function BottomActionBar({ children, style }: Props) {
  return (
    <View
      style={[
        {
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          backgroundColor: colors.bg.base,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: spacing.lg,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
