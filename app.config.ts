import type { ExpoConfig, ConfigContext } from 'expo/config';

// newArchEnabled is valid in Expo SDK 52 but not yet reflected in the ExpoConfig type definition
type ExpoConfigWithNewArch = ExpoConfig & {
  experiments?: ExpoConfig['experiments'] & { newArchEnabled?: boolean };
};

export default ({ config }: ConfigContext): ExpoConfigWithNewArch => ({
  ...config,
  name: 'Ascend',
  slug: 'ascend',
  version: '1.0.0',
  scheme: 'ascend',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.personal.ascend',
  },
  android: {
    package: 'com.personal.ascend',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
  },
  experiments: {
    newArchEnabled: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
