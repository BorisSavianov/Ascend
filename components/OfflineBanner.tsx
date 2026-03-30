import React from 'react';
import { Text, View } from 'react-native';
import { useNetworkStatus } from '../lib/supabase';

export default function OfflineBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View className="bg-amber-500 px-4 py-2 items-center">
      <Text className="text-black text-xs font-medium">
        You're offline. Showing cached data.
      </Text>
    </View>
  );
}
