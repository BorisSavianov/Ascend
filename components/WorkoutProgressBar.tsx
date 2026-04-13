import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './ui/Button';
import { colors, fontFamily, motion, spacing, typography } from '../lib/theme';

type Props = {
  completedSets: number;
  totalSets: number;
  elapsedSeconds: number;
  onFinish: () => void;
  isFinishing: boolean;
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutProgressBar({
  completedSets,
  totalSets,
  elapsedSeconds,
  onFinish,
  isFinishing,
}: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    const fraction = totalSets > 0 ? completedSets / totalSets : 0;
    progress.value = withTiming(fraction, { duration: motion.standard });
  }, [completedSets, totalSets]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const halfDone = totalSets > 0 && completedSets >= Math.ceil(totalSets / 2);

  return (
    <View
      style={{
        backgroundColor: colors.bg.surfaceOverlay,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
        paddingBottom: Math.max(insets.bottom, spacing.lg),
        paddingTop: spacing.md,
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
      }}
    >
      {/* Progress track */}
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border.subtle,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.intensity.primary,
            },
            barStyle,
          ]}
        />
      </View>

      {/* Stats row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={[
            typography.caption,
            {
              color: colors.text.secondary,
              fontFamily: fontFamily.monoRegular,
              fontVariant: ['tabular-nums'],
            },
          ]}
        >
          {completedSets} / {totalSets} sets
        </Text>
        <Text
          style={[
            typography.caption,
            {
              color: colors.text.tertiary,
              fontFamily: fontFamily.monoMedium,
              fontVariant: ['tabular-nums'],
            },
          ]}
        >
          {formatTime(elapsedSeconds)}
        </Text>
      </View>

      {/* Finish button */}
      <Button
        label={halfDone ? 'Finish workout' : 'Finish early'}
        onPress={onFinish}
        loading={isFinishing}
        variant={halfDone ? 'intensity' : 'secondary'}
        size="md"
      />
    </View>
  );
}
