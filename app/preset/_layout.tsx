import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { colors } from '../../lib/theme';

export default function PresetLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.bg.canvas,
        },
        headerLeft: () => (
          <Pressable onPress={() => router.replace('/(tabs)/move/templates')}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        ),
      }}
    />
  );
}
