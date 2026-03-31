import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { FastingLog } from '../types/database';

type Props = {
  activeFast: FastingLog | null;
  targetHours: number;
  onStart: () => void;
  onEnd: () => void;
  isStarting: boolean;
  isEnding: boolean;
};

export default function FastingTimer({
  activeFast,
  targetHours,
  onStart,
  onEnd,
  isStarting,
  isEnding,
}: Props) {
  const [elapsedHours, setElapsedHours] = useState(0);

  // Re-compute elapsed time every 60 seconds from started_at — survives background/restart.
  // Depend on the full activeFast object so the cleanup fires correctly when the fast ends
  // (activeFast goes null → undefined?.started_at and null?.started_at are both undefined,
  // so the primitive dep would miss the transition).
  useEffect(() => {
    if (!activeFast) {
      setElapsedHours(0);
      return;
    }

    const startedAt = activeFast.started_at;

    function tick() {
      const elapsedMs = Date.now() - new Date(startedAt).getTime();
      setElapsedHours(elapsedMs / 3_600_000);
    }

    tick(); // immediate update
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [activeFast]);

  if (!activeFast) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Pressable
          onPress={onStart}
          disabled={isStarting}
          accessibilityRole="button"
          accessibilityLabel="Start fast"
          accessibilityState={{ disabled: isStarting }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#16a34a' : '#22c55e',
            paddingVertical: 14,
            paddingHorizontal: 40,
            borderRadius: 12,
            opacity: isStarting ? 0.6 : 1,
          })}
        >
          <Text style={{ color: '#000000', fontWeight: '700', fontSize: 15, letterSpacing: 1 }}>
            {isStarting ? 'STARTING…' : 'START FAST'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const totalMinutes = elapsedHours * 60;
  const displayHours = Math.floor(totalMinutes / 60);
  const displayMinutes = Math.floor(totalMinutes % 60);
  const progress = Math.min(elapsedHours / targetHours, 1);
  const isComplete = elapsedHours >= targetHours;

  return (
    <View style={{ paddingVertical: 12 }}>
      {/* Elapsed time */}
      <Text
        style={{
          color: isComplete ? '#22c55e' : '#ffffff',
          fontSize: 40,
          fontWeight: '700',
          textAlign: 'center',
          letterSpacing: 2,
        }}
      >
        {String(displayHours).padStart(2, '0')}:{String(displayMinutes).padStart(2, '0')}
      </Text>
      <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 2 }}>
        of {targetHours}h target
      </Text>

      {/* Progress bar */}
      <View
        style={{
          height: 6,
          backgroundColor: '#1f2937',
          borderRadius: 3,
          marginTop: 12,
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: isComplete ? '#22c55e' : '#f59e0b',
            borderRadius: 3,
          }}
        />
      </View>

      {/* End fast button */}
      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={onEnd}
          disabled={isEnding}
          accessibilityRole="button"
          accessibilityLabel="End fast"
          accessibilityState={{ disabled: isEnding }}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: '#ef4444',
            paddingVertical: 10,
            paddingHorizontal: 32,
            borderRadius: 10,
            opacity: isEnding || pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 14, letterSpacing: 1 }}>
            {isEnding ? 'ENDING…' : 'END FAST'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
