import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius, spacing, typography } from '../../lib/theme';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

type Props = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  trailing?: React.ReactNode;
  tone?: 'default' | 'accent';
};

export default function Chip({
  label,
  onPress,
  selected = false,
  trailing,
  tone = 'default',
}: Props) {
  const reducedMotion = useReducedMotionPreference();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const active = selected || tone === 'accent';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (!reducedMotion) {
            scale.value = withTiming(motion.pressScale, { duration: motion.fast });
          }
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: motion.fast });
        }}
        style={{
          minHeight: 44,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: active ? colors.accent.primaryMuted : colors.bg.surfaceRaised,
          borderWidth: 1,
          borderColor: active ? colors.accent.primary : colors.border.default,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Text
          style={[
            typography.bodySm,
            {
              color: active ? colors.text.primary : colors.text.secondary,
              fontFamily: typography.label.fontFamily,
            },
          ]}
        >
          {label}
        </Text>
        {trailing ? <View>{trailing}</View> : null}
      </Pressable>
    </Animated.View>
  );
}

