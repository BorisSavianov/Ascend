import React from 'react';
import { View, Text } from 'react-native';
import { CartesianChart, Line } from 'victory-native';

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
      <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#4b5563', fontSize: 12 }}>Not enough data</Text>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 40 }}>
      {/* First label */}
      <Text style={{ color: '#9ca3af', fontSize: 11, width: 36, textAlign: 'right', marginRight: 4 }}>
        {first.toFixed(1)}
      </Text>

      {/* Sparkline */}
      <View style={{ flex: 1, height: 40 }}>
        <CartesianChart
          data={chartData}
          xKey="index"
          yKeys={['weight']}
          padding={{ left: 0, right: 0, top: 4, bottom: 4 }}
        >
          {({ points }) => (
            <Line
              points={points.weight}
              color="#22c55e"
              strokeWidth={1.5}
            />
          )}
        </CartesianChart>
      </View>

      {/* Last label */}
      <Text style={{ color: '#9ca3af', fontSize: 11, width: 36, marginLeft: 4 }}>
        {last.toFixed(1)}
      </Text>
    </View>
  );
}
