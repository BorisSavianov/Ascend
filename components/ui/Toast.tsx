import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../lib/theme';

type Props = {
  message: string;
  tone?: 'default' | 'success' | 'danger';
};

export default function Toast({ message, tone = 'default' }: Props) {
  const backgroundColor =
    tone === 'success'
      ? colors.semantic.success
      : tone === 'danger'
        ? colors.semantic.danger
        : colors.bg.surfaceOverlay;

  const textColor =
    tone === 'default' ? colors.text.primary : colors.bg.canvas;

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(160)}
      style={{
        position: 'absolute',
        left: spacing.xl,
        right: spacing.xl,
        bottom: spacing['3xl'],
      }}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor:
            tone === 'default' ? colors.border.default : backgroundColor,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <Text style={[typography.bodySm, { color: textColor, textAlign: 'center' }]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

