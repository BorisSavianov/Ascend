import React from 'react';
import { Text, View } from 'react-native';
import Button from './ui/Button';
import Surface from './ui/Surface';
import Screen from './ui/Screen';
import { spacing, typography } from '../lib/theme';

type Props = { children: React.ReactNode; fallbackLabel?: string };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Screen>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: spacing.xl,
            }}
          >
            <Surface elevated>
              <Text style={typography.h2}>Something went wrong</Text>
              <Text style={[typography.bodySm, { marginTop: spacing.sm, marginBottom: spacing.xl }]}>
                {this.props.fallbackLabel ?? this.state.error?.message ?? 'Unknown error'}
              </Text>
              <Button
                label="Try again"
                onPress={() => this.setState({ hasError: false, error: null })}
              />
            </Surface>
          </View>
        </Screen>
      );
    }
    return this.props.children;
  }
}
