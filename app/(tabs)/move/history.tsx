import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { format, parseISO, subWeeks, startOfWeek, addDays, differenceInCalendarDays } from 'date-fns';
import { CartesianChart, Line } from 'victory-native';
import Screen from '../../../components/ui/Screen';
import AppHeader from '../../../components/ui/AppHeader';
import { useAllWorkoutSessions } from '../../../hooks/useAllWorkoutSessions';
import { useWorkoutPresets } from '../../../hooks/useWorkoutPresets';
import { usePresetExercises } from '../../../hooks/usePresetExercises';
import { useWorkoutVolume } from '../../../hooks/useWorkoutVolume';
import WorkoutSessionDetailSheet from '../../../components/WorkoutSessionDetailSheet';
import { SkeletonBox } from '../../../components/ui/Skeleton';
import Surface from '../../../components/ui/Surface';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import Chip from '../../../components/ui/Chip';
import type { WorkoutSessionWithExercises } from '../../../types/workout';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { differenceInMinutes } from 'date-fns';

const HEATMAP_WEEKS = 12;
const CELL_SIZE = 22;
const CELL_GAP = 3;

export default function WorkoutHistoryScreen() {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<WorkoutSessionWithExercises | null>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useAllWorkoutSessions();
  const { data: presets = [] } = useWorkoutPresets();
  const { data: selectedPresetExercises = [] } = usePresetExercises(selectedPresetId);
  const primaryExerciseTemplateId = selectedPresetExercises[0]?.exercise_template_id ?? null;
  const { data: volumeData = [] } = useWorkoutVolume(primaryExerciseTemplateId);

  // Filter sessions by selected preset
  const filteredSessions = useMemo(() => {
    if (!selectedPresetId) return sessions;
    return sessions.filter((s) => s.preset_id === selectedPresetId);
  }, [sessions, selectedPresetId]);

  // Build heatmap data: date string → set count
  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const session of sessions) {
      const sets = session.logged_exercises.reduce(
        (sum, le) => sum + le.logged_sets.filter((s) => s.is_completed).length,
        0,
      );
      map[session.date] = (map[session.date] ?? 0) + sets;
    }
    return map;
  }, [sessions]);

  // Build all-time PR map (best weight per exercise)
  const allTimeBests = useMemo(() => {
    const bests: Record<string, number> = {};
    for (const session of sessions) {
      for (const le of session.logged_exercises) {
        for (const set of le.logged_sets) {
          if (set.weight_kg != null && set.weight_kg > (bests[le.exercise_template_id] ?? 0)) {
            bests[le.exercise_template_id] = set.weight_kg;
          }
        }
      }
    }
    return bests;
  }, [sessions]);

  // Volume chart data
  const chartData = useMemo(
    () => volumeData.map((d, i) => ({ x: i, y: d.maxWeight, date: d.date })),
    [volumeData],
  );

  // Primary exercise name for selected preset
  const primaryExerciseName = selectedPresetExercises[0]?.exercise_template?.name ?? null;

  return (
    <Screen>
      <AppHeader title="Move" eyebrow="History" />

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <SegmentedControl
          options={[
            { label: 'Today', value: 'today' },
            { label: 'History', value: 'history' },
            { label: 'Templates', value: 'templates' },
          ]}
          value="history"
          onChange={(val) => {
            if (val === 'today')     router.push('/(tabs)/move');
            if (val === 'templates') router.push('/move/templates');
          }}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 132 }}>

        {/* Preset filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Chip
            label="All"
            selected={selectedPresetId === null}
            onPress={() => setSelectedPresetId(null)}
          />
          {presets.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.name}
              selected={selectedPresetId === preset.id}
              onPress={() =>
                setSelectedPresetId(selectedPresetId === preset.id ? null : preset.id)
              }
            />
          ))}
        </ScrollView>

        {/* Calendar heatmap */}
        <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
          <Text style={[typography.label, { marginBottom: spacing.md }]}>
            Last {HEATMAP_WEEKS} weeks
          </Text>
          <CalendarHeatmap heatmapData={heatmapData} />
        </View>

        {/* Volume chart (only when preset selected and data available) */}
        {selectedPresetId && chartData.length >= 2 ? (
          <Surface style={{ marginHorizontal: spacing.xl, marginBottom: spacing.xl }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>
              {primaryExerciseName ?? 'Primary exercise'} — max weight
            </Text>
            <Text style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.lg }]}>
              Last {chartData.length} sessions
            </Text>
            <View style={{ height: 160 }}>
              <VolumeChart data={chartData} />
            </View>
          </Surface>
        ) : selectedPresetId && chartData.length < 2 ? (
          <Surface style={{ marginHorizontal: spacing.xl, marginBottom: spacing.xl }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>
              {primaryExerciseName ?? 'Primary exercise'} — max weight
            </Text>
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>
              Not enough data yet — complete 2+ sessions to see progress.
            </Text>
          </Surface>
        ) : null}

        {/* Session list */}
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
          <Text style={typography.label}>
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          </Text>

          {sessionsLoading ? (
            [1, 2, 3].map((i) => (
              <SkeletonBox key={i} width="100%" height={72} borderRadius={radius.md} />
            ))
          ) : filteredSessions.length === 0 ? (
            <Surface>
              <Text style={typography.h3}>No workouts yet</Text>
              <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                Start from the Today tab.
              </Text>
            </Surface>
          ) : (
            filteredSessions.map((session) => (
              <Pressable
                key={session.id}
                onPress={() => setSelectedSession(session)}
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                  backgroundColor: colors.bg.surface,
                  padding: spacing.lg,
                  gap: spacing.xs,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={typography.label}>
                    {format(parseISO(session.date), 'EEE, d MMM')}
                  </Text>
                  {session.ended_at ? (
                    <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                      {differenceInMinutes(parseISO(session.ended_at), parseISO(session.started_at))} min
                    </Text>
                  ) : null}
                </View>
                <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                  {session.session_snapshot?.preset_name ?? 'Ad-hoc workout'}
                </Text>
                <Text style={[typography.caption, { color: colors.text.disabled }]}>
                  {session.logged_exercises.length} exercise{session.logged_exercises.length !== 1 ? 's' : ''}
                  {' · '}
                  {session.logged_exercises.reduce(
                    (sum, le) => sum + le.logged_sets.filter((s) => s.is_completed).length,
                    0,
                  )} sets
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <WorkoutSessionDetailSheet
        visible={selectedSession !== null}
        session={selectedSession}
        allTimeBests={allTimeBests}
        onClose={() => setSelectedSession(null)}
      />
    </Screen>
  );
}

// ── Calendar Heatmap ──────────────────────────────────────────────────────────

function CalendarHeatmap({ heatmapData }: { heatmapData: Record<string, number> }) {
  const today = new Date();
  const gridStart = startOfWeek(subWeeks(today, HEATMAP_WEEKS - 1), { weekStartsOn: 0 });

  // Build 12 columns × 7 rows of dates
  const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) => {
    return Array.from({ length: 7 }, (_, d) => {
      const date = addDays(gridStart, w * 7 + d);
      const dateStr = format(date, 'yyyy-MM-dd');
      const setCount = heatmapData[dateStr] ?? 0;
      const isFuture = differenceInCalendarDays(date, today) > 0;
      return { date, dateStr, setCount, isFuture };
    });
  });

  function cellColor(setCount: number, isFuture: boolean) {
    if (isFuture) return 'transparent';
    if (setCount === 0) return colors.border.subtle;
    if (setCount <= 5) return colors.intensity.primary + '40';
    if (setCount <= 12) return colors.intensity.primary + '80';
    return colors.intensity.primary + 'CC';
  }

  return (
    <View style={{ flexDirection: 'row', gap: CELL_GAP }}>
      {weeks.map((week, w) => (
        <View key={w} style={{ flexDirection: 'column', gap: CELL_GAP }}>
          {week.map((cell) => (
            <View
              key={cell.dateStr}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: 4,
                backgroundColor: cellColor(cell.setCount, cell.isFuture),
                borderWidth: cell.isFuture ? 0 : 0,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Volume Line Chart ─────────────────────────────────────────────────────────

function VolumeChart({ data }: { data: Array<{ x: number; y: number; date: string }> }) {
  return (
    <CartesianChart
      data={data}
      xKey="x"
      yKeys={['y']}
      domainPadding={{ left: 10, right: 10, top: 20, bottom: 10 }}
    >
      {({ points }) => (
        <Line
          points={points.y}
          color={colors.intensity.primary}
          strokeWidth={2}
          animate={{ type: 'timing', duration: 300 }}
        />
      )}
    </CartesianChart>
  );
}
