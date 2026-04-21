import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/ui/Screen';
import AppHeader from '../../../components/ui/AppHeader';
import Button from '../../../components/ui/Button';
import TextField from '../../../components/ui/TextField';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import EmptyState from '../../../components/EmptyState';
import ListRow from '../../../components/ui/ListRow';
import { SkeletonBox } from '../../../components/ui/Skeleton';
import { useWeekAssignments } from '../../../hooks/useWeekAssignments';
import { useWorkoutPresets } from '../../../hooks/useWorkoutPresets';
import { useUpsertDayAssignment } from '../../../hooks/useUpsertDayAssignment';
import { useCreatePreset } from '../../../hooks/useCreatePreset';
import { colors, motion, radius, spacing, typography } from '../../../lib/theme';
import { ScrollView } from 'react-native';

const DAY_ABBREVS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Day Assignment Sheet
// ---------------------------------------------------------------------------

type DayAssignmentSheetProps = {
  visible: boolean;
  dayOfWeek: number | null;
  currentPresetId: string | null;
  presets: Array<{ id: string; name: string }>;
  onSelect: (presetId: string | null) => void;
  onClose: () => void;
};

function DayAssignmentSheet({
  visible,
  dayOfWeek,
  currentPresetId,
  presets,
  onSelect,
  onClose,
}: DayAssignmentSheetProps) {
  const translateY = useSharedValue(400);
  const [pressedId, setPressedId] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, motion.spring.default);
    } else {
      translateY.value = withTiming(400, { duration: motion.deliberate });
    }
  }, [visible, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (dayOfWeek === null) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop */}
        <Pressable
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.overlay,
          }}
          onPress={onClose}
        />

        {/* Sheet */}
        <Animated.View
          style={[
            {
              backgroundColor: colors.bg.surfaceOverlay,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: spacing['4xl'],
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.lg,
            },
            sheetStyle,
          ]}
        >
          {/* Handle bar */}
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border.strong,
              alignSelf: 'center',
              marginBottom: spacing.xl,
            }}
          />

          {/* Title */}
          <Text
            style={[
              typography.h2,
              { marginBottom: spacing.xl },
            ]}
          >
            {DAY_NAMES[dayOfWeek]}
          </Text>

          {/* Rest day row */}
          <Pressable
            onPressIn={() => setPressedId('rest')}
            onPressOut={() => setPressedId(null)}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(null);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.lg,
              gap: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border.subtle,
              backgroundColor: pressedId === 'rest' ? colors.bg.surfaceRaised : 'transparent',
            }}
          >
            <Ionicons name="moon-outline" size={18} color={colors.text.tertiary} />
            <Text
              style={[
                typography.body,
                {
                  flex: 1,
                  color: currentPresetId === null ? colors.text.primary : colors.text.secondary,
                },
              ]}
            >
              Rest day
            </Text>
            {currentPresetId === null && (
              <Ionicons name="checkmark" size={18} color={colors.accent.primary} />
            )}
          </Pressable>

          {/* Preset rows */}
          {presets.map((preset, index) => {
            const isSelected = currentPresetId === preset.id;
            const isLast = index === presets.length - 1;
            return (
              <Pressable
                key={preset.id}
                onPressIn={() => setPressedId(preset.id)}
                onPressOut={() => setPressedId(null)}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(preset.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.lg,
                  gap: spacing.md,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: colors.border.subtle,
                  backgroundColor: pressedId === preset.id ? colors.bg.surfaceRaised : 'transparent',
                }}
              >
                <Ionicons
                  name="barbell-outline"
                  size={18}
                  color={isSelected ? colors.intensity.primary : colors.text.tertiary}
                />
                <Text
                  style={[
                    typography.body,
                    {
                      flex: 1,
                      color: isSelected ? colors.intensity.primary : colors.text.primary,
                    },
                  ]}
                >
                  {preset.name}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={18} color={colors.intensity.primary} />
                )}
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// New Workout Sheet
// ---------------------------------------------------------------------------

type NewWorkoutSheetProps = {
  visible: boolean;
  name: string;
  onChangeName: (text: string) => void;
  onCreate: () => void;
  onClose: () => void;
  isCreating: boolean;
};

function NewWorkoutSheet({
  visible,
  name,
  onChangeName,
  onCreate,
  onClose,
  isCreating,
}: NewWorkoutSheetProps) {
  const translateY = useSharedValue(400);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, motion.spring.default);
    } else {
      translateY.value = withTiming(400, { duration: motion.deliberate });
    }
  }, [visible, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop */}
        <Pressable
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.overlay,
          }}
          onPress={onClose}
        />

        {/* Sheet */}
        <Animated.View
          style={[
            {
              backgroundColor: colors.bg.surfaceOverlay,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: spacing['4xl'],
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.lg,
              gap: spacing.xl,
            },
            sheetStyle,
          ]}
        >
          {/* Handle bar */}
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border.strong,
              alignSelf: 'center',
              marginBottom: spacing.xl,
            }}
          />

          {/* Title */}
          <Text style={typography.h2}>New Workout</Text>

          {/* Name input */}
          <TextField
            label="Name"
            value={name}
            onChangeText={onChangeName}
            placeholder="e.g. Push Day"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onCreate}
          />

          {/* Actions */}
          <View style={{ gap: spacing.sm }}>
            <Button
              label="Create"
              variant="primary"
              onPress={onCreate}
              loading={isCreating}
              disabled={name.trim().length === 0}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              disabled={isCreating}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function WorkoutTemplatesScreen() {
  const today = new Date();
  const { data: weekAssignments = [] } = useWeekAssignments();
  const { data: presets = [], isLoading: presetsLoading } = useWorkoutPresets();
  const { mutate: upsertAssignment } = useUpsertDayAssignment();
  const { mutate: createPreset, isPending: isCreating } = useCreatePreset();

  // Day assignment sheet state
  const [selectedDayForAssignment, setSelectedDayForAssignment] = useState<number | null>(null);

  // New workout sheet state
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  // Day cell animation state (for each day 0-6)
  const dayScales = DAY_ABBREVS.map(() => useSharedValue(1));
  const dayOpacities = DAY_ABBREVS.map(() => useSharedValue(1));

  // Build a map: day_of_week → preset or null
  const assignmentMap = React.useMemo(() => {
    const map: Record<number, { id: string; name: string } | null> = {};
    for (const a of weekAssignments) {
      map[a.day_of_week] = a.preset ?? null;
    }
    return map;
  }, [weekAssignments]);

  const currentDayPresetId =
    selectedDayForAssignment !== null
      ? (assignmentMap[selectedDayForAssignment]?.id ?? null)
      : null;

  function handleDayPress(dayIndex: number) {
    setSelectedDayForAssignment(dayIndex);
  }

  function handleAssignPreset(presetId: string | null) {
    if (selectedDayForAssignment === null) return;
    upsertAssignment({ dayOfWeek: selectedDayForAssignment, presetId });
    setSelectedDayForAssignment(null);
  }

  function handleCloseAssignSheet() {
    setSelectedDayForAssignment(null);
  }

  function handleOpenNewWorkout() {
    setNewWorkoutName('');
    setShowNewWorkout(true);
  }

  function handleCloseNewWorkout() {
    setShowNewWorkout(false);
    setNewWorkoutName('');
  }

  function handleCreateWorkout() {
    const trimmed = newWorkoutName.trim();
    if (!trimmed) return;
    createPreset(trimmed, {
      onSuccess: (data) => {
        setShowNewWorkout(false);
        setNewWorkoutName('');
        router.push({
          pathname: '/preset/[presetId]',
          params: { presetId: data.id, name: data.name },
        });
      },
    });
  }

  return (
    <>
      <Screen scroll contentContainerStyle={{ paddingBottom: 132 }}>
        {/* Header */}
        <AppHeader title="Move" eyebrow={format(today, 'EEEE, d MMMM')} subtitle="Templates" />

        {/* Segmented control */}
        <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
          <SegmentedControl
            options={[
              { label: 'Today', value: 'today' },
              { label: 'History', value: 'history' },
              { label: 'Templates', value: 'templates' },
            ]}
            value="templates"
            onChange={(v) => {
              if (v === 'today') router.push('/(tabs)/move');
              if (v === 'history') router.push('/(tabs)/move/history');
            }}
          />
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>
          {/* ── Section A: Your Week ───────────────────────────────────────── */}
          <View style={{
            backgroundColor: colors.bg.surfaceRaised,
            padding: spacing.lg,
            borderRadius: radius.md,
            gap: spacing.md,
            marginBottom: spacing['2xl'],
          }}>
            <Text
              style={[
                typography.label,
                {
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                },
              ]}
            >
              Your Week
            </Text>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.xs }}
              >
                {DAY_ABBREVS.map((abbrev, index) => {
                  const assigned = assignmentMap[index] ?? null;
                  const isAssigned = assigned !== null;
                  const presetName = assigned?.name || 'Unnamed';
                  const presetLabel = assigned
                    ? presetName.length > 8
                      ? presetName.slice(0, 7) + '…'
                      : presetName
                    : 'Rest';

                const animatedStyle = useAnimatedStyle(() => ({
                  transform: [{ scale: dayScales[index].value }],
                  opacity: dayOpacities[index].value,
                }));

                const handleDayCellPressIn = () => {
                  dayScales[index].value = withTiming(0.96, { duration: motion.instant });
                  dayOpacities[index].value = withTiming(0.7, { duration: motion.instant });
                };

                const handleDayCellPressOut = () => {
                  dayScales[index].value = withSpring(1, motion.spring.snappy);
                  dayOpacities[index].value = withSpring(1, motion.spring.snappy);
                };

                const handleDayCellPress = async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleDayPress(index);
                };

                return (
                  <Animated.View key={index} style={animatedStyle}>
                    <Pressable
                      onPressIn={handleDayCellPressIn}
                      onPressOut={handleDayCellPressOut}
                      onPress={handleDayCellPress}
                      style={{
                        flex: 1,
                        width: 64,
                        height: 56,
                        borderRadius: radius.sm,
                        borderWidth: isAssigned ? 2 : 1,
                        borderColor: isAssigned
                          ? colors.intensity.primary
                          : colors.border.subtle,
                        backgroundColor: isAssigned
                          ? colors.intensity.muted
                          : colors.bg.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.xs,
                        paddingHorizontal: spacing.xs,
                      }}
                    >
                    <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                      {abbrev}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        typography.bodySm,
                        {
                          fontSize: 10,
                          lineHeight: 13,
                          color: isAssigned
                            ? colors.intensity.primary
                            : colors.text.disabled,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      {presetLabel}
                    </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
              </ScrollView>
            </View>

          {/* ── Section B: Workouts ────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing['2xl'] }}>
            <View style={{
              borderBottomWidth: 1,
              borderBottomColor: colors.border.subtle,
              paddingBottom: spacing.md,
              marginBottom: spacing.lg,
            }}>
              <Text
                style={[
                  typography.label,
                  {
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  },
                ]}
              >
                Workouts
              </Text>
            </View>

            {presetsLoading ? (
              <View style={{ gap: spacing.sm }}>
                {[1, 2, 3].map((i) => (
                  <SkeletonBox key={i} width="100%" height={64} borderRadius={radius.md} />
                ))}
              </View>
            ) : presets.length === 0 ? (
              <EmptyState
                title="No workouts yet"
                message="Create your first workout template below."
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {presets.map((preset, i) => (
                  <Animated.View key={preset.id} entering={FadeInDown.delay(i * 60).duration(250).springify()}>
                    <ListRow
                      title={preset.name}
                      leading={<Ionicons name="barbell-outline" size={18} color={colors.intensity.primary} />}
                      trailing={<Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({
                          pathname: '/preset/[presetId]',
                          params: { presetId: preset.id, name: preset.name },
                        });
                      }}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </View>

          {/* ── Footer: New Workout ────────────────────────────────────────── */}
          <Button
            label="New Workout"
            variant="secondary"
            onPress={handleOpenNewWorkout}
          />
        </View>
      </Screen>

      {/* Day Assignment Sheet */}
      <DayAssignmentSheet
        visible={selectedDayForAssignment !== null}
        dayOfWeek={selectedDayForAssignment}
        currentPresetId={currentDayPresetId}
        presets={presets}
        onSelect={handleAssignPreset}
        onClose={handleCloseAssignSheet}
      />

      {/* New Workout Sheet */}
      <NewWorkoutSheet
        visible={showNewWorkout}
        name={newWorkoutName}
        onChangeName={setNewWorkoutName}
        onCreate={handleCreateWorkout}
        onClose={handleCloseNewWorkout}
        isCreating={isCreating}
      />
    </>
  );
}
