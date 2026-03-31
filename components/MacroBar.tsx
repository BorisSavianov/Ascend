import React from 'react';
import { View, Text } from 'react-native';

type Props = {
  proteinG: number;
  fatG: number;
  carbsG: number;
  targets?: { protein: number; fat: number; carbs: number };
};

// Calorie contributions
const PROTEIN_KCAL = 4;
const FAT_KCAL = 9;
const CARBS_KCAL = 4;

// Colours
const PROTEIN_COLOR = '#f59e0b'; // warm amber
const FAT_COLOR = '#6b83a6';     // slate blue
const CARBS_COLOR = '#6ba87a';   // sage green

export default function MacroBar({ proteinG, fatG, carbsG, targets }: Props) {
  const proteinKcal = proteinG * PROTEIN_KCAL;
  const fatKcal = fatG * FAT_KCAL;
  const carbsKcal = carbsG * CARBS_KCAL;
  const total = proteinKcal + fatKcal + carbsKcal;

  const proteinPct = total > 0 ? (proteinKcal / total) * 100 : 33.3;
  const fatPct = total > 0 ? (fatKcal / total) * 100 : 33.3;
  const carbsPct = total > 0 ? (carbsKcal / total) * 100 : 33.4;

  return (
    <View className="w-full">
      {/* Segmented bar */}
      <View
        style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' }}
      >
        <View style={{ flex: proteinPct, backgroundColor: PROTEIN_COLOR }} />
        <View style={{ flex: carbsPct, backgroundColor: CARBS_COLOR }} />
        <View style={{ flex: fatPct, backgroundColor: FAT_COLOR }} />
      </View>

      {/* Labels row */}
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <MacroLabel
          label="Protein"
          grams={proteinG}
          target={targets?.protein}
          color={PROTEIN_COLOR}
        />
        <MacroLabel
          label="Carbs"
          grams={carbsG}
          target={targets?.carbs}
          color={CARBS_COLOR}
        />
        <MacroLabel
          label="Fat"
          grams={fatG}
          target={targets?.fat}
          color={FAT_COLOR}
        />
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
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginBottom: 4 }} />
      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
        {Math.round(grams)}g
      </Text>
      {target != null ? (
        <Text style={{ color: '#6b7280', fontSize: 11 }}>/ {target}g</Text>
      ) : null}
      <Text style={{ color: '#c4c9d4', fontSize: 11, marginTop: 1 }}>{label}</Text>
    </View>
  );
}
