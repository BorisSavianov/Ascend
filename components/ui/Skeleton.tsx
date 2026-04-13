import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../../lib/theme';

const SHIMMER_COLORS = [
  colors.bg.surfaceRaised,
  colors.bg.surfaceOverlay,
  colors.bg.surfaceRaised,
] as const;

type SkeletonBoxProps = {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animated shimmer placeholder for loading states.
 * Replaces ActivityIndicator — shape should match the content it stands for.
 */
export function SkeletonBox({
  width = '100%',
  height,
  borderRadius = radius.sm,
  style,
}: SkeletonBoxProps) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 300 }],
  }));

  return (
    <View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.bg.surfaceRaised,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -300,
            width: 300,
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={SHIMMER_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

type SkeletonTextProps = {
  /** Width as a fraction (0–1) of the container, or a fixed pixel value */
  width?: number | string;
  lines?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * One or more skeleton text lines.
 * Default: single line at 80% width. Multi-line: last line is shorter.
 */
export function SkeletonText({
  width = '80%',
  lines = 1,
  style,
}: SkeletonTextProps) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={i === lines - 1 && lines > 1 ? '55%' : width}
          height={14}
          borderRadius={radius.xs}
        />
      ))}
    </View>
  );
}
