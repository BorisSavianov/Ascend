import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function NotFound() {
  useEffect(() => {
    // Defer navigation until after the root layout has mounted
    const t = setTimeout(() => router.replace('/(auth)/login'), 0);
    return () => clearTimeout(t);
  }, []);

  return <View />;
}
