import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from './ui/Surface';
import Button from './ui/Button';
import { colors, radius, spacing, typography } from '../lib/theme';

type Props = {
  dayName: string;
  onLogCardio: () => void;
};

export default function RestDayCard({ dayName, onLogCardio }: Props) {
  return (
    <Surface>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.pill,
            backgroundColor: colors.bg.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="moon-outline" size={24} color={colors.text.tertiary} />
        </View>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text style={typography.h3}>Rest Day</Text>
          <Text style={[typography.bodySm, { textAlign: 'center' }]}>
            {dayName} — Recovery and optional cardio
          </Text>
        </View>
        <Button
          label="Log cardio"
          onPress={onLogCardio}
          variant="ghost"
          size="md"
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    </Surface>
  );
}
