import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadows, spacing } from '../../lib/theme';

type GradientVariant = keyof typeof gradients;

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  elevated?: boolean;
  overlay?: boolean;
  /** Apply a named gradient background instead of a flat fill */
  gradient?: GradientVariant;
};

export default function Surface({
  children,
  style,
  padding = 'xl',
  elevated = false,
  overlay = false,
  gradient,
}: Props) {
  const borderRadius = radius.lg;
  const borderColor = elevated ? colors.border.default : colors.border.subtle;

  const containerStyle: ViewStyle = {
    borderRadius,
    borderWidth: 1,
    borderColor,
    overflow: 'hidden',
    ...(elevated ? shadows.md : {}),
  };

  const innerStyle: ViewStyle = {
    padding: spacing[padding],
  };

  if (gradient) {
    return (
      <View style={[containerStyle, style]}>
        <LinearGradient
          colors={gradients[gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
          style={[{ flex: 1 }, innerStyle]}
        >
          {children}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      style={[
        containerStyle,
        {
          backgroundColor: overlay
            ? colors.bg.surfaceOverlay
            : elevated
              ? colors.bg.surfaceRaised
              : colors.bg.surface,
          ...innerStyle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
