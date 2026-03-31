import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius, spacing, typography } from '../../lib/theme';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  leading?: React.ReactNode;
};

function getVariantStyle(variant: Variant, disabled: boolean) {
  if (disabled) {
    return {
      backgroundColor: colors.bg.surfaceRaised,
      borderColor: colors.border.subtle,
      textColor: colors.text.disabled,
    };
  }

  switch (variant) {
    case 'secondary':
      return {
        backgroundColor: colors.bg.surfaceRaised,
        borderColor: colors.border.default,
        textColor: colors.text.primary,
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderColor: colors.border.default,
        textColor: colors.text.secondary,
      };
    case 'destructive':
      return {
        backgroundColor: colors.semantic.danger,
        borderColor: colors.semantic.danger,
        textColor: colors.bg.canvas,
      };
    case 'primary':
    default:
      return {
        backgroundColor: colors.accent.primary,
        borderColor: colors.accent.primary,
        textColor: colors.bg.canvas,
      };
  }
}

export default function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'lg',
  style,
  leading,
}: Props) {
  const reducedMotion = useReducedMotionPreference();
  const scale = useSharedValue(1);

  const variantStyle = getVariantStyle(variant, disabled || loading);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.72 : 1,
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={() => {
          if (reducedMotion) return;
          scale.value = withTiming(motion.pressScale, { duration: motion.fast });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: motion.fast });
        }}
        style={{
          minHeight: size === 'lg' ? 56 : 52,
          borderRadius: radius.md,
          borderWidth: variant === 'ghost' || variant === 'secondary' ? 1 : 0,
          borderColor: variantStyle.borderColor,
          backgroundColor: variantStyle.backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
        }}
      >
        {loading ? (
          <ActivityIndicator
            color={variantStyle.textColor}
          />
        ) : (
          <>
            {leading ? <View>{leading}</View> : null}
            <Text
              style={[
                typography.bodySm,
                {
                  color: variantStyle.textColor,
                  fontFamily: typography.label.fontFamily,
                },
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
