import React, { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius, spacing, typography } from '../../lib/theme';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import Button from './Button';

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmationSheet({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
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
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: colors.overlay,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onCancel} />
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
            },
            sheetStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 42,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border.strong,
            }}
          />
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.h2}>{title}</Text>
            {description ? (
              <Text style={typography.bodySm}>{description}</Text>
            ) : null}
          </View>
          <Button
            label={confirmLabel}
            onPress={onConfirm}
            variant={tone === 'danger' ? 'destructive' : 'primary'}
          />
          <Button
            label={cancelLabel}
            onPress={onCancel}
            variant="secondary"
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

