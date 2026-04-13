import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius, shadows, spacing, typography } from '../../lib/theme';

type Props = {
  message: string;
  tone?: 'default' | 'success' | 'danger';
};

export default function Toast({ message, tone = 'default' }: Props) {
  const translateY = useSharedValue(-64);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Slide in from top
    translateY.value = withSpring(0, motion.spring.snappy);
    opacity.value = withTiming(1, { duration: motion.fast });

    return () => {
      // Slide out on unmount
      translateY.value = withTiming(-64, { duration: motion.fast });
      opacity.value = withTiming(0, { duration: motion.fast });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

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
      style={[
        {
          position: 'absolute',
          top: spacing['3xl'],
          left: spacing.xl,
          right: spacing.xl,
          zIndex: 999,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          {
            backgroundColor,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor:
              tone === 'default' ? colors.border.strong : backgroundColor,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
          shadows.lg,
        ]}
      >
        <Text style={[typography.label, { color: textColor, textAlign: 'center' }]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
