import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { FastingLog } from '../types/database';
import { colors, motion, spacing, typography } from '../lib/theme';
import Button from './ui/Button';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';

type Props = {
  activeFast: FastingLog | null;
  targetHours: number;
  onStart: () => void;
  onEnd: () => void;
  isStarting: boolean;
  isEnding: boolean;
};

export default function FastingTimer({
  activeFast,
  targetHours,
  onStart,
  onEnd,
  isStarting,
  isEnding,
}: Props) {
  const reducedMotion = useReducedMotionPreference();
  const [elapsedHours, setElapsedHours] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    if (!activeFast) {
      setElapsedHours(0);
      return;
    }

    const startedAt = activeFast.started_at;
    function tick() {
      const elapsedMs = Date.now() - new Date(startedAt).getTime();
      setElapsedHours(elapsedMs / 3_600_000);
    }

    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [activeFast]);

  const progress = activeFast ? Math.min(elapsedHours / targetHours, 1) : 0;

  useEffect(() => {
    if (!progressWidth) return;
    animatedWidth.value = withTiming(progressWidth * progress, {
      duration: reducedMotion ? motion.fast : motion.slow,
    });
  }, [animatedWidth, progress, progressWidth, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    width: animatedWidth.value,
  }));

  function onTrackLayout(event: LayoutChangeEvent) {
    setProgressWidth(event.nativeEvent.layout.width);
  }

  if (!activeFast) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <Button
          label={isStarting ? 'Starting…' : 'Start fast'}
          onPress={onStart}
          loading={isStarting}
        />
      </View>
    );
  }

  const totalMinutes = elapsedHours * 60;
  const displayHours = Math.floor(totalMinutes / 60);
  const displayMinutes = Math.floor(totalMinutes % 60);
  const isComplete = elapsedHours >= targetHours;

  return (
    <View style={{ paddingVertical: spacing.md }}>
      <Text
        style={[
          typography.metricLg,
          {
            textAlign: 'center',
            color: isComplete ? colors.semantic.success : colors.text.primary,
          },
        ]}
      >
        {String(displayHours).padStart(2, '0')}:{String(displayMinutes).padStart(2, '0')}
      </Text>
      <Text style={[typography.caption, { textAlign: 'center', marginTop: spacing.xs }]}>
        Toward your {targetHours}h target
      </Text>

      <View
        onLayout={onTrackLayout}
        style={{
          height: 8,
          marginTop: spacing.lg,
          marginBottom: spacing.xl,
          backgroundColor: colors.bg.surfaceRaised,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 999,
              backgroundColor: isComplete ? colors.semantic.success : colors.semantic.warning,
            },
            fillStyle,
          ]}
        />
      </View>

      <Button
        label={isEnding ? 'Ending…' : 'End fast'}
        onPress={onEnd}
        loading={isEnding}
        variant="secondary"
      />
    </View>
  );
}
