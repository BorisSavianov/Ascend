import React, { forwardRef, useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../lib/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  unit?: string;
  style?: StyleProp<ViewStyle>;
};

const TextField = forwardRef<TextInput, Props>(function TextField({
  label,
  hint,
  error,
  unit,
  style,
  ...inputProps
}, ref) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.semantic.danger
    : focused
      ? colors.accent.primary
      : colors.border.default;

  return (
    <View style={style}>
      {label ? (
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          minHeight: 52,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.bg.input,
          paddingHorizontal: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <TextInput
          {...inputProps}
          ref={ref}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          placeholderTextColor={colors.text.tertiary}
          style={[
            typography.body,
            {
              flex: 1,
              minHeight: 52,
              color: colors.text.primary,
              paddingVertical: spacing.md,
            },
          ]}
        />
        {unit ? (
          <Text style={[typography.label, { color: colors.text.tertiary }]}>
            {unit}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text
          style={[
            typography.caption,
            {
              color: colors.semantic.danger,
              marginTop: spacing.sm,
            },
          ]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export default TextField;
