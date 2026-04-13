import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, fontFamily, radius, spacing, typography } from '../lib/theme';

type Props = {
  proteinG: number;
  fatG: number;
  carbsG: number;
  targets?: { protein: number; fat: number; carbs: number };
};

const PROTEIN_COLOR = colors.semantic.warning;
const FAT_COLOR     = colors.semantic.info;
const CARBS_COLOR   = colors.semantic.success;

export default function MacroBar({ proteinG, fatG, carbsG, targets }: Props) {
  const proteinKcal = proteinG * 4;
  const fatKcal     = fatG * 9;
  const carbsKcal   = carbsG * 4;
  const total       = proteinKcal + fatKcal + carbsKcal;

  const proteinPct = total > 0 ? proteinKcal / total : 0.33;
  const carbsPct   = total > 0 ? carbsKcal   / total : 0.33;
  const fatPct     = total > 0 ? fatKcal     / total : 0.34;

  const proteinAnim = useSharedValue(0);
  const carbsAnim   = useSharedValue(0);
  const fatAnim     = useSharedValue(0);

  const easing = Easing.out(Easing.poly(4));
  const duration = 350;

  useEffect(() => {
    proteinAnim.value = withTiming(proteinPct, { duration, easing });
    carbsAnim.value   = withTiming(carbsPct,   { duration, easing });
    fatAnim.value     = withTiming(fatPct,     { duration, easing });
  }, [proteinPct, carbsPct, fatPct, proteinAnim, carbsAnim, fatAnim]); // eslint-disable-line react-hooks/exhaustive-deps

  const proteinStyle = useAnimatedStyle(() => ({ flex: proteinAnim.value }));
  const carbsStyle   = useAnimatedStyle(() => ({ flex: carbsAnim.value }));
  const fatStyle     = useAnimatedStyle(() => ({ flex: fatAnim.value }));

  return (
    <View style={{ width: '100%' }}>
      <View
        style={{
          flexDirection: 'row',
          height: 8,
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor: colors.bg.surfaceRaised,
        }}
      >
        <Animated.View style={[{ backgroundColor: PROTEIN_COLOR }, proteinStyle]} />
        <Animated.View style={[{ backgroundColor: CARBS_COLOR },   carbsStyle]} />
        <Animated.View style={[{ backgroundColor: FAT_COLOR },     fatStyle]} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.md }}>
        <MacroLabel label="Protein" grams={proteinG} target={targets?.protein} color={PROTEIN_COLOR} />
        <MacroLabel label="Carbs"   grams={carbsG}   target={targets?.carbs}   color={CARBS_COLOR} />
        <MacroLabel label="Fat"     grams={fatG}     target={targets?.fat}     color={FAT_COLOR} />
      </View>
    </View>
  );
}

function MacroLabel({
  label,
  grams,
  target,
  color,
}: {
  label:   string;
  grams:   number;
  target?: number;
  color:   string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: color,
          }}
        />
        <Text style={[typography.caption, { fontFamily: fontFamily.medium }]}>{label}</Text>
      </View>
      <Text
        style={[
          typography.metricSm,
          { marginTop: spacing.xs },
        ]}
      >
        {Math.round(grams)}g
      </Text>
      {target != null ? (
        <Text style={typography.caption}>/ {target}g</Text>
      ) : null}
    </View>
  );
}
