import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import {
  Easing,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { parseISO, isToday } from 'date-fns';
import { colors, fontFamily, spacing, typography } from '../lib/theme';
import { useWindowDimensions } from 'react-native';

const CHART_H   = 120; // bar area height
const BAR_W     = 26;
const CORNER_R  = 6;
const STAGGER   = 50;  // ms per bar

type DayDatum = {
  log_date: string;
  total_calories: number;
};

type Props = {
  data: DayDatum[];
};

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeeklyChart({ data }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - spacing.xl * 2; // matches screen horizontal padding

  if (data.length === 0) {
    return (
      <View style={{ height: CHART_H + 28, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={typography.caption}>No data this week</Text>
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const maxCals = Math.max(...sorted.map((d) => d.total_calories), 1);

  return (
    <View style={{ gap: spacing.xs }}>
      <AnimatedBars data={sorted} maxCals={maxCals} chartWidth={chartWidth} />
      {/* Day labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 2 }}>
        {sorted.map((d) => {
          const todayBar = isToday(parseISO(d.log_date));
          return (
            <Text
              key={d.log_date}
              style={[
                typography.caption,
                {
                  width: BAR_W,
                  textAlign: 'center',
                  fontFamily: fontFamily.medium,
                  color: todayBar ? colors.accent.primary : colors.text.disabled,
                },
              ]}
            >
              {DAY_ABBR[parseISO(d.log_date).getDay()] ?? ''}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function AnimatedBars({
  data,
  maxCals,
  chartWidth,
}: {
  data: DayDatum[];
  maxCals: number;
  chartWidth: number;
}) {
  const n = data.length;
  // Create one shared value per bar
  const progresses = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ].slice(0, n);

  useEffect(() => {
    progresses.forEach((sv, i) => {
      sv.value = 0;
      sv.value = withDelay(
        i * STAGGER,
        withTiming(1, {
          duration: 280,
          easing: Easing.out(Easing.poly(4)),
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.map((d) => d.log_date).join(',')]);

  // Spacing: distribute bars evenly across chartWidth
  const slot = chartWidth / n;

  return (
    <View style={{ height: CHART_H }}>
      {data.map((d, i) => {
        const targetH = Math.max((d.total_calories / maxCals) * CHART_H * 0.88, 4);
        const isT = isToday(parseISO(d.log_date));
        const barColor = isT ? colors.accent.primary : colors.border.strong;
        const barX = slot * i + (slot - BAR_W) / 2;

        return (
          <AnimatedBar
            key={d.log_date}
            progress={progresses[i]!}
            targetH={targetH}
            x={barX}
            barW={BAR_W}
            chartH={CHART_H}
            color={barColor}
            isToday={isT}
          />
        );
      })}
    </View>
  );
}

import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

function AnimatedBar({
  progress,
  targetH,
  x,
  barW,
  chartH,
  color,
  isToday: _isToday,
}: {
  progress:  SharedValue<number>;
  targetH:   number;
  x:         number;
  barW:      number;
  chartH:    number;
  color:     string;
  isToday:   boolean;
}) {
  // Derive height and y-position from Reanimated shared value
  const height = useDerivedValue(() => progress.value * targetH);
  const y      = useDerivedValue(() => chartH - height.value);

  return (
    <Canvas style={{ position: 'absolute', left: x, top: 0, width: barW, height: chartH }}>
      <RoundedRect
        x={0}
        y={y}
        width={barW}
        height={height}
        r={CORNER_R}
        color={color}
      />
    </Canvas>
  );
}
