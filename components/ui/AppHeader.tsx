import React from 'react';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  trailing?: React.ReactNode;
};

export default function AppHeader({ title, subtitle, eyebrow, trailing }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: spacing.lg,
      }}
    >
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text
            style={[
              typography.caption,
              {
                marginBottom: spacing.sm,
                color: colors.text.tertiary,
                letterSpacing: 0.4,
              },
            ]}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text style={typography.h1}>{title}</Text>
        {subtitle ? (
          <Text
            style={[
              typography.bodySm,
              {
                marginTop: spacing.xs,
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}
