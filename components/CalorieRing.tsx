import React from 'react';
import { View, Text } from 'react-native';
import { PolarChart, Pie } from 'victory-native';

type Props = {
  consumed: number;
  target: number;
  size?: number;
};

export default function CalorieRing({ consumed, target, size = 180 }: Props) {
  const isOver = consumed >= target;
  const remaining = isOver ? 0 : target - consumed;

  const data = isOver
    ? [{ label: 'consumed', value: 1, color: '#ef4444' }]
    : [
        { label: 'consumed', value: consumed > 0 ? consumed : 0.001, color: '#22c55e' },
        { label: 'remaining', value: remaining, color: '#1f2937' },
      ];

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <PolarChart
        data={data}
        labelKey="label"
        valueKey="value"
        colorKey="color"
        containerStyle={{ width: size, height: size }}
      >
        <Pie.Chart innerRadius="60%">
          {() => <Pie.Slice />}
        </Pie.Chart>
      </PolarChart>

      {/* Centre text overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <Text
          style={{
            color: isOver ? '#ef4444' : '#ffffff',
            fontSize: size * 0.22,
            fontWeight: '700',
            lineHeight: size * 0.26,
          }}
        >
          {Math.round(consumed)}
        </Text>
        <Text
          style={{
            color: '#6b7280',
            fontSize: size * 0.09,
            marginTop: 2,
          }}
        >
          kcal
        </Text>
      </View>
    </View>
  );
}
