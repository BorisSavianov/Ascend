import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, motion, radius, spacing, typography } from '../lib/theme';
import { useExerciseTemplates } from '../hooks/useExerciseTemplates';
import { useAddPresetExercise } from '../hooks/useAddPresetExercise';
import { usePresetExercises } from '../hooks/usePresetExercises';
import type { ExerciseTemplate } from '../types/workout';

type Props = {
  visible: boolean;
  presetId: string;
  currentCount: number;
  onClose: () => void;
};

export default function ExercisePickerSheet({
  visible,
  presetId,
  currentCount,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');

  const { data: templates } = useExerciseTemplates();
  const { data: presetExercises } = usePresetExercises(presetId);
  const { mutate: addExercise } = useAddPresetExercise();

  const translateY = useSharedValue(visible ? 0 : 48);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, motion.spring.default);
      opacity.value = withTiming(1, { duration: motion.fast });
    } else {
      translateY.value = withTiming(64, { duration: motion.fast });
      opacity.value = withTiming(0, { duration: motion.fast });
    }
  }, [visible]);

  // Reset search when sheet closes
  useEffect(() => {
    if (!visible) {
      setSearch('');
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Build a set of already-added template IDs
  const addedIds = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const pe of presetExercises ?? []) {
      set.add(pe.exercise_template_id);
    }
    return set;
  }, [presetExercises]);

  const allTemplates: ExerciseTemplate[] = templates ?? [];

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTemplates;
    return allTemplates.filter((t) =>
      t.name.toLowerCase().includes(q)
    );
  }, [allTemplates, search]);

  // Grouped data (only when search is empty)
  const grouped = useMemo<{ group: string; items: ExerciseTemplate[] }[]>(() => {
    if (search.trim()) return [];
    const map = new Map<string, ExerciseTemplate[]>();
    for (const t of allTemplates) {
      const key = t.muscle_group;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [allTemplates, search]);

  function handleSelect(template: ExerciseTemplate) {
    if (addedIds.has(template.id)) return;
    addExercise({
      presetId,
      exerciseTemplateId: template.id,
      sortOrder: currentCount,
      defaultSets: template.target_sets,
      defaultRepsMin: template.target_reps_min,
      defaultRepsMax: template.target_reps_max,
    });
    onClose();
  }

  const isSearching = search.trim().length > 0;

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
              padding: spacing.xl,
              gap: spacing.lg,
              maxHeight: '80%',
            },
            sheetStyle,
          ]}
        >
          {/* Handle bar */}
          <View
            style={{
              alignSelf: 'center',
              width: 42,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border.strong,
            }}
          />

          {/* Title */}
          <Text style={typography.h2}>Add Exercise</Text>

          {/* Search field */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.bg.input,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.border.default,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <Ionicons
              name="search"
              size={16}
              color={colors.text.tertiary}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises…"
              placeholderTextColor={colors.text.tertiary}
              style={[
                typography.bodySm,
                {
                  flex: 1,
                  padding: 0,
                  color: colors.text.primary,
                },
              ]}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Exercise list */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: '65%' }}
            keyboardShouldPersistTaps="handled"
          >
            {isSearching ? (
              // Flat list
              filtered.map((template, index) => (
                <ExerciseRow
                  key={template.id}
                  template={template}
                  isAdded={addedIds.has(template.id)}
                  isLast={index === filtered.length - 1}
                  onPress={() => handleSelect(template)}
                />
              ))
            ) : (
              // Grouped list
              grouped.map(({ group, items }) => (
                <View key={group}>
                  <Text
                    style={[
                      typography.label,
                      {
                        color: colors.text.tertiary,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        marginTop: spacing.lg,
                        marginBottom: spacing.xs,
                      },
                    ]}
                  >
                    {group}
                  </Text>
                  {items.map((template, index) => (
                    <ExerciseRow
                      key={template.id}
                      template={template}
                      isAdded={addedIds.has(template.id)}
                      isLast={index === items.length - 1}
                      onPress={() => handleSelect(template)}
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ExerciseRow
// ---------------------------------------------------------------------------

type RowProps = {
  template: ExerciseTemplate;
  isAdded: boolean;
  isLast: boolean;
  onPress: () => void;
};

function ExerciseRow({ template, isAdded, isLast, onPress }: RowProps) {
  const content = (
    <View
      style={{
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border.subtle,
        opacity: isAdded ? 0.5 : 1,
      }}
    >
      {/* Labels */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[typography.bodySm, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {template.name}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {template.equipment}
        </Text>
      </View>

      {/* Right icon */}
      {isAdded ? (
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={colors.semantic.success}
        />
      ) : (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.text.tertiary}
        />
      )}
    </View>
  );

  if (isAdded) {
    return <View>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}
