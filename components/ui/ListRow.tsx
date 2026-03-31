import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  minHeight?: number;
};

export default function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  danger = false,
  minHeight = 56,
}: Props) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      {...(onPress ? { onPress } : {})}
      style={{
        minHeight,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
      }}
    >
      {leading ? <View>{leading}</View> : null}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.body,
            {
              color: danger ? colors.semantic.danger : colors.text.primary,
            },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { marginTop: spacing.xs }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </Wrapper>
  );
}
