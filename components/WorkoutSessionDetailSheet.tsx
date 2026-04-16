import React, { useEffect } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { colors, motion, radius, spacing, typography } from '../lib/theme';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';
import type { WorkoutSessionWithExercises } from '../types/workout';
import type { ExerciseRow } from '../types/database';

type Props = {
  visible: boolean;
  session: WorkoutSessionWithExercises | null;
  // Map of exerciseTemplateId → best weight ever seen (for PR detection)
  allTimeBests: Record<string, number>;
  onClose: () => void;
};

export default function WorkoutSessionDetailSheet({
  visible,
  session,
  allTimeBests,
  onClose,
}: Props) {
  const reducedMotion = useReducedMotionPreference();
  const translateY = useSharedValue(600);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 600, {
      duration: reducedMotion ? 0 : motion.standard,
    });
  }, [visible, reducedMotion]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, 600], [1, 0]),
  }));

  const { data: linkedCardio = [] } = useQuery<ExerciseRow[]>({
    queryKey: ['session_cardio', session?.id],
    queryFn: async () => {
      if (!session) return [];
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('workout_session_id', session.id)
        .order('logged_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ExerciseRow[];
    },
    enabled: !!session,
  });

  if (!session) return null;

  const duration =
    session.ended_at
      ? differenceInMinutes(parseISO(session.ended_at), parseISO(session.started_at))
      : null;

  const presetName =
    session.session_snapshot?.preset_name ?? 'Ad-hoc workout';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.bg.canvas,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: '85%',
          },
          sheetStyle,
        ]}
      >
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border.strong,
            }}
          />
        </View>

        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <Text style={typography.h2}>
            {format(parseISO(session.date), 'EEEE, d MMM yyyy')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>
              {presetName}
            </Text>
            {duration != null ? (
              <>
                <Text style={[typography.caption, { color: colors.text.disabled }]}>·</Text>
                <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                  {duration} min
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Exercise list */}
        <FlatList
          data={session.logged_exercises}
          keyExtractor={(le) => le.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            gap: spacing.lg,
          }}
          ListFooterComponent={
            linkedCardio.length > 0 ? (
              <View style={{ marginTop: spacing.lg }}>
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border.subtle,
                    paddingTop: spacing.lg,
                    gap: spacing.sm,
                  }}
                >
                  <Text style={typography.label}>Cardio</Text>
                  {linkedCardio.map((ex) => (
                    <View
                      key={ex.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: spacing.xs,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.subtle,
                      }}
                    >
                      <Text style={[typography.bodySm, { flex: 1 }]}>{ex.name}</Text>
                      <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                        {ex.duration_min} min · {ex.calories_burned} kcal
                      </Text>
                    </View>
                  ))}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingTop: spacing.xs,
                    }}
                  >
                    <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                      Total cardio
                    </Text>
                    <Text style={[typography.caption, { color: colors.text.secondary }]}>
                      {linkedCardio.reduce((sum, ex) => sum + (ex.calories_burned ?? 0), 0)} kcal
                    </Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item: le }) => {
            const completedSets = le.logged_sets.filter((s) => s.is_completed);
            if (completedSets.length === 0) return null;

            const prWeightForExercise = allTimeBests[le.exercise_template_id] ?? 0;

            return (
              <View>
                <Text style={[typography.label, { marginBottom: spacing.sm }]}>
                  {le.exercise_template.name}
                </Text>
                {completedSets.map((set) => {
                  const isPR =
                    set.weight_kg != null &&
                    set.weight_kg > 0 &&
                    set.weight_kg >= prWeightForExercise;

                  return (
                    <View
                      key={set.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.subtle,
                      }}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { width: 40, color: colors.text.tertiary },
                        ]}
                      >
                        Set {set.set_number}
                      </Text>
                      <Text style={[typography.bodySm, { flex: 1 }]}>
                        {set.weight_kg != null ? `${set.weight_kg} kg` : '—'}
                        {set.reps != null ? ` × ${set.reps}` : ''}
                      </Text>
                      {isPR ? (
                        <View
                          style={{
                            backgroundColor: colors.semantic.warning + '33',
                            borderRadius: radius.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                          }}
                        >
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.semantic.warning, fontWeight: '700' },
                            ]}
                          >
                            PR
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          }}
        />
      </Animated.View>
    </Modal>
  );
}
