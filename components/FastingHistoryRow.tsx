import React from 'react';
import { Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import type { FastingLog } from '../types/database';
import { colors, spacing, typography } from '../lib/theme';

type Props = {
  fast: FastingLog;
};

export default function FastingHistoryRow({ fast }: Props) {
  const startDate = format(parseISO(fast.started_at), 'd MMM');
  const durationH = fast.actual_hours != null ? fast.actual_hours.toFixed(1) : '—';
  const completed = fast.completed;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 58,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        backgroundColor: colors.bg.surface,
      }}
    >
      <Text style={[typography.bodySm, { width: 56 }]}>{startDate}</Text>
      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
        <View
          style={{
            height: 6,
            backgroundColor: colors.bg.surfaceRaised,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.min(((fast.actual_hours ?? 0) / 16) * 100, 100)}%`,
              backgroundColor: completed ? colors.semantic.success : colors.semantic.warning,
              borderRadius: 999,
            }}
          />
        </View>
      </View>
      <Text
        style={[
          typography.label,
          {
            width: 48,
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {durationH}h
      </Text>
      <Text
        style={[
          typography.label,
          {
            color: completed ? colors.semantic.success : colors.semantic.danger,
            marginLeft: spacing.sm,
          },
        ]}
      >
        {completed ? 'Done' : 'Ended'}
      </Text>
    </View>
  );
}
