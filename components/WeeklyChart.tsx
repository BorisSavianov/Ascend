import React from 'react';
import { Text, View } from 'react-native';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { parseISO } from 'date-fns';
import { colors, typography } from '../lib/theme';

type DayDatum = {
  log_date: string;
  total_calories: number;
};

type Props = {
  data: DayDatum[];
};

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeeklyChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <View style={{ height: 176, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={typography.caption}>No data this week</Text>
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const chartData = sorted.map((d, i) => ({
    dayIndex: i,
    calories: Math.round(d.total_calories),
    label: DAY_ABBR[parseISO(d.log_date).getDay()] ?? '',
  }));

  return (
    <View style={{ height: 176 }}>
      <CartesianChart
        data={chartData}
        xKey="dayIndex"
        yKeys={['calories']}
        domainPadding={{ left: 20, right: 20, top: 28, bottom: 12 }}
        axisOptions={{
          font: null,
          labelColor: colors.text.tertiary,
          lineColor: colors.border.default,
          tickCount: { x: chartData.length, y: 4 },
          formatXLabel: (val) => {
            const item = chartData.find((d) => d.dayIndex === val);
            return item?.label ?? '';
          },
        }}
      >
        {({ points }) => (
          <>
            <Line
              points={points.calories}
              color={colors.accent.primary}
              strokeWidth={2.5}
              animate={{ type: 'timing', duration: 320 }}
            />
            <Scatter
              points={points.calories}
              color={colors.accent.primary}
              radius={4.5}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}
