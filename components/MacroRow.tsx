import React from 'react';
import { Text, View } from 'react-native';
import { formatGrams } from '../lib/calculations';

type Props = {
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export default function MacroRow({ proteinG, fatG, carbsG }: Props) {
  return (
    <View className="flex-row justify-around py-3">
      <MacroColumn label="Protein" value={formatGrams(proteinG)} />
      <MacroColumn label="Fat" value={formatGrams(fatG)} />
      <MacroColumn label="Carbs" value={formatGrams(carbsG)} />
    </View>
  );
}

function MacroColumn({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-white text-lg font-semibold">{value}</Text>
      <Text className="text-gray-400 text-xs mt-0.5">{label}</Text>
    </View>
  );
}
