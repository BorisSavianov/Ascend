import React from 'react';
import { Text, View } from 'react-native';
import { PolarChart, Pie } from 'victory-native';
import { colors, metricStyle, spacing, typography } from '../lib/theme';

type Props = {
  consumed: number;
  target: number;
  size?: number;
};

export default function CalorieRing({ consumed, target, size = 188 }: Props) {
  const isOver = consumed >= target;
  const remaining = Math.max(target - consumed, 0);

  const data: { label: string; value: number; color: string }[] = isOver
    ? [
        { label: 'consumed', value: Math.max(consumed, 1), color: colors.semantic.warning },
      ]
    : [
        {
          label: 'consumed',
          value: consumed > 0 ? consumed : 0.001,
          color: colors.accent.primary,
        },
        {
          label: 'remaining',
          value: Math.max(remaining, 0.001),
          color: colors.bg.surfaceRaised,
        },
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
        <Pie.Chart innerRadius="72%">
          {() => <Pie.Slice />}
        </Pie.Chart>
      </PolarChart>

      <View
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        }}
        pointerEvents="none"
      >
        <Text style={metricStyle('lg')}>{Math.round(consumed)}</Text>
        <Text style={typography.caption}>consumed kcal</Text>
        <Text
          style={[
            typography.bodySm,
            {
              marginTop: spacing.sm,
              color: isOver ? colors.semantic.warning : colors.text.secondary,
            },
          ]}
        >
          {isOver ? `${Math.round(consumed - target)} over target` : `${Math.round(remaining)} remaining`}
        </Text>
      </View>
    </View>
  );
}
