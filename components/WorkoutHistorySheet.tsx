import React, { useEffect } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { colors, motion, radius, spacing, typography } from '../lib/theme';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';
import type { WorkoutSessionWithExercises } from '../types/workout';

type Props = {
  visible: boolean;
  workoutDayName: string;
  sessions: WorkoutSessionWithExercises[];
  isLoading: boolean;
  onClose: () => void;
};

function SessionRow({ session }: { session: WorkoutSessionWithExercises }) {
  const duration =
    session.ended_at
      ? differenceInMinutes(parseISO(session.ended_at), parseISO(session.started_at))
      : null;

  return (
    <View
      style={{
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[typography.label, { color: colors.text.primary }]}>
          {format(parseISO(session.date), 'EEEE, d MMM yyyy')}
        </Text>
        {duration != null ? (
          <Text style={[typography.caption, { color: colors.text.tertiary }]}>
            {duration} min
          </Text>
        ) : null}
      </View>
      {session.logged_exercises.map((le) => {
        const completedSets = le.logged_sets.filter((s) => s.is_completed);
        if (completedSets.length === 0) return null;
        const setSummary = completedSets
          .map((s) => {
            if (s.weight_kg != null && s.reps != null) return `${s.weight_kg}kg×${s.reps}`;
            if (s.reps != null) return `×${s.reps}`;
            return null;
          })
          .filter(Boolean)
          .join(', ');
        return (
          <Text
            key={le.id}
            style={[typography.caption, { color: colors.text.secondary }]}
            numberOfLines={1}
          >
            {le.exercise_template.name}: {setSummary}
          </Text>
        );
      })}
    </View>
  );
}

export default function WorkoutHistorySheet({
  visible,
  workoutDayName,
  sessions,
  isLoading,
  onClose,
}: Props) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reducedMotion ? motion.fast : motion.slow,
    });
  }, [progress, reducedMotion, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [32, 0]) }],
    opacity: progress.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: colors.overlay,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          style={[
            {
              backgroundColor: colors.bg.surfaceOverlay,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border.default,
              maxHeight: '75%',
            },
            sheetStyle,
          ]}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.border.strong,
              }}
            />
          </View>

          {/* Header */}
          <View style={{ padding: spacing.xl, paddingTop: spacing.lg, gap: spacing.xs }}>
            <Text style={typography.h2}>History</Text>
            <Text style={typography.bodySm}>{workoutDayName}</Text>
          </View>

          {/* Sessions list */}
          {isLoading ? (
            <View style={{ padding: spacing.xl }}>
              <Text style={typography.bodySm}>Loading…</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={{ padding: spacing.xl }}>
              <Text style={typography.bodySm}>No previous sessions for this day.</Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => <SessionRow session={item} />}
              contentContainerStyle={{
                paddingHorizontal: spacing.xl,
                paddingBottom: spacing['3xl'],
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
