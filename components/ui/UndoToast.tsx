import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../lib/theme';

type Props = {
  message: string;
  onUndo: () => void;
};

export default function UndoToast({ message, onUndo }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(160)}
      style={{
        position: 'absolute',
        left: spacing.xl,
        right: spacing.xl,
        bottom: spacing['3xl'],
      }}
    >
      <View
        style={{
          backgroundColor: colors.bg.surfaceOverlay,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border.default,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text style={[typography.bodySm, { flex: 1 }]}>{message}</Text>
        <Pressable
          onPress={onUndo}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Undo"
        >
          <Text
            style={[
              typography.bodySm,
              {
                color: colors.accent.primary,
                fontFamily: typography.label.fontFamily,
              },
            ]}
          >
            Undo
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
