import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  message: string;
};

export default function EmptyState({ message }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-gray-400 text-base text-center">{message}</Text>
    </View>
  );
}
