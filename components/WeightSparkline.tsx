import React from 'react';
import { Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { colors, fontFamily, typography } from '../lib/theme';

type DataPoint = {
  date: string;
  weight_kg: number;
};

type Props = {
  data: DataPoint[];
};

export default function WeightSparkline({ data }: Props) {
  if (data.length < 2) {
    return (
      <View style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={typography.caption}>Not enough data</Text>
      </View>
    );
  }

  const chartData = data.map((d, i) => ({
    index: i,
    weight: d.weight_kg,
  }));

  const first = data[0]!.weight_kg;
  const last = data[data.length - 1]!.weight_kg;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 48 }}>
      <Text
        style={[
          typography.caption,
          {
            width: 44,
            textAlign: 'right',
            marginRight: 6,
            fontFamily: fontFamily.monoRegular,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {first.toFixed(1)}
      </Text>
      <View style={{ flex: 1, height: 48 }}>
        <CartesianChart
          data={chartData}
          xKey="index"
          yKeys={['weight']}
          padding={{ left: 4, right: 4, top: 6, bottom: 6 }}
        >
          {({ points }) => (
            <Line
              points={points.weight}
              color={colors.accent.primary}
              strokeWidth={2}
            />
          )}
        </CartesianChart>
      </View>
      <Text
        style={[
          typography.caption,
          {
            width: 44,
            marginLeft: 6,
            fontFamily: fontFamily.monoRegular,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {last.toFixed(1)}
      </Text>
    </View>
  );
}
