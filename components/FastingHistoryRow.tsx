import React from 'react';
import { View, Text } from 'react-native';
import { format, parseISO } from 'date-fns';
import type { FastingLog } from '../types/database';

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
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1f2937',
      }}
    >
      {/* Date */}
      <Text style={{ color: '#c4c9d4', fontSize: 13, width: 52 }}>{startDate}</Text>

      {/* Duration bar */}
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <View style={{ height: 4, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${Math.min(((fast.actual_hours ?? 0) / 16) * 100, 100)}%`,
              backgroundColor: completed ? '#22c55e' : '#f59e0b',
              borderRadius: 2,
            }}
          />
        </View>
      </View>

      {/* Duration text */}
      <Text style={{ color: '#d1d5db', fontSize: 13, width: 40, textAlign: 'right' }}>
        {durationH}h
      </Text>

      {/* Status badge */}
      <Text
        style={{
          fontSize: 15,
          marginLeft: 8,
          color: completed ? '#22c55e' : '#ef4444',
        }}
      >
        {completed ? '✓' : '✗'}
      </Text>
    </View>
  );
}
