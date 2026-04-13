import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import ReAnimated, { FadeInDown } from 'react-native-reanimated';
import { calculateNutrition, formatCalories } from '../lib/calculations';
import type { MealItemDraft } from '../store/useAppStore';
import { colors, fontFamily, radius, spacing, typography } from '../lib/theme';

type Props = {
  item: MealItemDraft;
  onAmountChange: (id: string, amountG: number) => void;
  onRemove: (id: string) => void;
};

export default function MealItemRow({ item, onAmountChange, onRemove }: Props) {
  const swipeableRef = useRef<Swipeable>(null);
  const [amountText, setAmountText] = useState(String(item.amountG));

  useEffect(() => {
    setAmountText(String(item.amountG));
  }, [item.amountG]);

  const nutrition = calculateNutrition(
    {
      calories_per_100g: item.caloriesPer100g,
      protein_per_100g: item.proteinPer100g,
      fat_per_100g: item.fatPer100g,
      carbs_per_100g: item.carbsPer100g,
      fiber_per_100g: item.fiberPer100g,
    },
    item.amountG,
  );

  function handleAmountChange(text: string) {
    setAmountText(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      onAmountChange(item.id, parsed);
    }
  }

  function renderRightActions(
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) {
    // Parallax: icon slides in from right as swipe opens
    const iconTranslate = dragX.interpolate({
      inputRange: [-104, 0],
      outputRange: [0, 24],
      extrapolate: 'clamp',
    });

    // Background fades from transparent → danger red as swipe progresses
    const bgColor = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255,69,58,0)', 'rgba(255,69,58,1)'],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={{
          width: 104,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            swipeableRef.current?.close();
            onRemove(item.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.foodName}`}
          style={{
            flex: 1,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Animated.View style={{ alignItems: 'center', transform: [{ translateX: iconTranslate }] }}>
            <Ionicons name="trash-outline" size={18} color={colors.text.primary} />
            <Text
              style={[
                typography.caption,
                {
                  color: colors.text.primary,
                  marginTop: spacing.xs,
                },
              ]}
            >
              Delete
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <ReAnimated.View entering={FadeInDown.duration(220)}>
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      rightThreshold={52}
      friction={2}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      }}
    >
      <View
        style={{
          minHeight: 72,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.bg.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={typography.body} numberOfLines={1}>
            {item.foodName}
          </Text>
          <Text style={[typography.caption, { marginTop: spacing.xs }]}>
            {formatCalories(nutrition.calories)} kcal
          </Text>
        </View>
        <View
          style={{
            minWidth: 98,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.bg.input,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            alignItems: 'center',
          }}
        >
          <TextInput
            value={amountText}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            style={[
              typography.bodySm,
              {
                color: colors.text.primary,
                fontFamily: fontFamily.monoRegular,
                minWidth: 52,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              },
            ]}
            selectTextOnFocus
          />
          <Text style={typography.caption}>grams</Text>
        </View>
      </View>
    </Swipeable>
    </ReAnimated.View>
  );
}
