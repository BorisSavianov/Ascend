import React from 'react';
import { View, Text } from 'react-native';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { parseISO } from 'date-fns';

type DayDatum = {
  log_date: string;
  total_calories: number;
};

type Props = {
  data: DayDatum[];
};

// Day abbreviations
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeeklyChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#4b5563', fontSize: 13 }}>No data this week</Text>
      </View>
    );
  }

  // Victory Native v41 CartesianChart expects data with numeric xKey.
  // Use a sequential index (0, 1, 2 ...) to avoid collisions when the dataset
  // spans a week boundary where two entries share the same getDay() value.
  // Sort by date first so the sequential index always goes oldest → newest.
  const sorted = [...data].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const chartData = sorted.map((d, i) => ({
    dayIndex: i,
    calories: Math.round(d.total_calories),
    label: DAY_ABBR[parseISO(d.log_date).getDay()] ?? '',
  }));

  return (
    <View style={{ height: 160 }}>
      <CartesianChart
        data={chartData}
        xKey="dayIndex"
        yKeys={['calories']}
        domainPadding={{ left: 16, right: 16, top: 24, bottom: 8 }}
        axisOptions={{
          font: null,
          labelColor: '#6b7280',
          lineColor: '#374151',
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
              color="#22c55e"
              strokeWidth={2}
              animate={{ type: 'timing', duration: 500 }}
            />
            <Scatter
              points={points.calories}
              color="#22c55e"
              radius={4}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

