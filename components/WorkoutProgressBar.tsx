import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './ui/Button';
import { colors, fontFamily, motion, spacing, typography } from '../lib/theme';

type Props = {
  completedSets: number;
  totalSets: number;
  elapsedLabel: string;
  onFinish: () => void;
  isFinishing: boolean;
};

export default function WorkoutProgressBar({
  completedSets,
  totalSets,
  elapsedLabel,
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

  const countScale = useSharedValue(1);

  useEffect(() => {
    countScale.value = withSequence(
      withTiming(1.15, { duration: motion.fast }),
      withTiming(1,    { duration: motion.fast }),
    );
  }, [completedSets]); // eslint-disable-line react-hooks/exhaustive-deps

  const countAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
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
        <Animated.View style={countAnimStyle}>
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
        </Animated.View>
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
          {elapsedLabel}
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
