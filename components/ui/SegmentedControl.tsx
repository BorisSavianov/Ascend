import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, motion, radius, spacing, typography } from '../../lib/theme';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

type Option<T extends string | number> = {
  label: string;
  value: T;
};

type Props<T extends string | number> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: Props<T>) {
  const reducedMotion = useReducedMotionPreference();
  const [width, setWidth] = useState(0);
  const selectedIndex = useMemo(
    () => Math.max(options.findIndex((option) => option.value === value), 0),
    [options, value],
  );
  const x = useSharedValue(0);

  useEffect(() => {
    if (!width || options.length === 0) return;
    const segmentWidth = width / options.length;
    x.value = reducedMotion
      ? selectedIndex * segmentWidth
      : withSpring(selectedIndex * segmentWidth, motion.spring);
  }, [options.length, reducedMotion, selectedIndex, width, x]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const segmentWidth = width && options.length > 0 ? width / options.length : 0;

  return (
    <View
      onLayout={handleLayout}
      style={{
        backgroundColor: colors.bg.surfaceRaised,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {segmentWidth ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: Math.max(segmentWidth - 8, 0),
              borderRadius: radius.pill,
              backgroundColor: colors.accent.primaryMuted,
              borderWidth: 1,
              borderColor: colors.accent.primary,
            },
            animatedStyle,
          ]}
        />
      ) : null}
      <View style={{ flexDirection: 'row' }}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
              }}
            >
              <Text
                style={[
                  typography.bodySm,
                  {
                    color: isActive ? colors.text.primary : colors.text.tertiary,
                    fontFamily: typography.label.fontFamily,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
