import React from 'react';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

type Props = {
  proteinG: number;
  fatG: number;
  carbsG: number;
  targets?: { protein: number; fat: number; carbs: number };
};

const PROTEIN_COLOR = colors.semantic.warning;
const FAT_COLOR = colors.semantic.info;
const CARBS_COLOR = colors.semantic.success;

export default function MacroBar({ proteinG, fatG, carbsG, targets }: Props) {
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsKcal = carbsG * 4;
  const total = proteinKcal + fatKcal + carbsKcal;

  const proteinPct = total > 0 ? proteinKcal / total : 0.33;
  const carbsPct = total > 0 ? carbsKcal / total : 0.33;
  const fatPct = total > 0 ? fatKcal / total : 0.34;

  return (
    <View style={{ width: '100%' }}>
      <View
        style={{
          flexDirection: 'row',
          height: 10,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: colors.bg.surfaceRaised,
        }}
      >
        <View style={{ flex: proteinPct, backgroundColor: PROTEIN_COLOR }} />
        <View style={{ flex: carbsPct, backgroundColor: CARBS_COLOR }} />
        <View style={{ flex: fatPct, backgroundColor: FAT_COLOR }} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.md }}>
        <MacroLabel label="Protein" grams={proteinG} target={targets?.protein} color={PROTEIN_COLOR} />
        <MacroLabel label="Carbs" grams={carbsG} target={targets?.carbs} color={CARBS_COLOR} />
        <MacroLabel label="Fat" grams={fatG} target={targets?.fat} color={FAT_COLOR} />
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
  label: string;
  grams: number;
  target?: number;
  color: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
        <Text style={typography.label}>{label}</Text>
      </View>
      <Text
        style={[
          typography.body,
          {
            marginTop: spacing.sm,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {Math.round(grams)}g
      </Text>
      {target != null ? (
        <Text style={typography.caption}>Target {target}g</Text>
      ) : null}
    </View>
  );
}
