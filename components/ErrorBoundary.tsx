import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

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
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-lg font-semibold mb-2 text-white">Something went wrong</Text>
          <Text className="text-sm text-gray-500 mb-6 text-center">
            {this.props.fallbackLabel ?? this.state.error?.message ?? 'Unknown error'}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-3 bg-black rounded-full"
          >
            <Text className="text-white font-medium">Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
