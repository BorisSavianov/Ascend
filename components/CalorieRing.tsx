import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, shadows, spacing, typography } from '../lib/theme';

const STROKE = 22;
const ENTRY_DURATION = 350;

type Props = {
  consumed: number;
  target: number;
  size?: number;
};

export default function CalorieRing({ consumed, target, size = 200 }: Props) {
  const isOver = consumed >= target;
  const progress = consumed > 0 ? Math.min(consumed / Math.max(target, 1), 1.5) : 0;

  // Animated progress value (0 → actual fraction)
  const animProgress = useSharedValue(0);

  // Count-up display value
  const [displayedCalories, setDisplayedCalories] = useState(0);

  useEffect(() => {
    animProgress.value = 0;
    animProgress.value = withTiming(progress, {
      duration: ENTRY_DURATION,
      easing: Easing.out(Easing.poly(4)),
    });
  }, [consumed, target, progress, animProgress]);

  // Count-up: update displayed number incrementally
  useEffect(() => {
    if (consumed === 0) {
      setDisplayedCalories(0);
      return;
    }
    let startTime: number | null = null;
    const start = displayedCalories;
    const end = Math.round(consumed);

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const fraction = Math.min(elapsed / ENTRY_DURATION, 1);
      const eased = 1 - Math.pow(1 - fraction, 4); // outQuart
      setDisplayedCalories(Math.round(start + (end - start) * eased));
      if (fraction < 1) requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [consumed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ring geometry
  const margin = STROKE / 2 + 2;
  const rect = {
    x:      margin,
    y:      margin,
    width:  size - margin * 2,
    height: size - margin * 2,
  };

  // Static background ring path (full 360°)
  const bgPath = Skia.Path.Make();
  bgPath.addArc(rect, -90, 359.99);

  // Animated foreground arc path
  const fgPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const sweepDeg = Math.max(animProgress.value * 360, 0.01);
    p.addArc(rect, -90, Math.min(sweepDeg, 359.99));
    return p;
  });

  const ringColor = isOver ? colors.semantic.warning : colors.accent.primary;
  const remaining = Math.max(target - consumed, 0);

  const accessibilityLabel = `${Math.round(consumed)} kcal consumed${
    isOver
      ? `, ${Math.round(consumed - target)} over target`
      : `, ${Math.round(remaining)} remaining`
  }`;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          position: 'relative',
          alignSelf: 'center',
        },
        shadows.accentGlow,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      <Canvas style={{ width: size, height: size }}>
        {/* Background track */}
        <Path
          path={bgPath}
          style="stroke"
          strokeWidth={STROKE}
          color={colors.bg.surfaceRaised}
          strokeCap="round"
        />
        {/* Animated fill */}
        <Path
          path={fgPath}
          style="stroke"
          strokeWidth={STROKE}
          color={ringColor}
          strokeCap="round"
        />
      </Canvas>

      {/* Center content */}
      <View
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        }}
        pointerEvents="none"
      >
        <Text style={typography.metricHero} numberOfLines={1} adjustsFontSizeToFit>
          {displayedCalories.toLocaleString()}
        </Text>
        <Text
          style={[
            typography.caption,
            { marginTop: spacing.xs, color: colors.text.tertiary },
          ]}
        >
          consumed kcal
        </Text>
        <Text
          style={[
            typography.metricSm,
            {
              marginTop: spacing.xs,
              color: isOver ? colors.semantic.warning : colors.text.secondary,
            },
          ]}
        >
          {isOver
            ? `+${Math.round(consumed - target)} over`
            : `${Math.round(remaining)} left`}
        </Text>
      </View>
    </View>
  );
}
