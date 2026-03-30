import type { ExpoConfig, ConfigContext } from 'expo/config';

// newArchEnabled is valid in Expo SDK 52 but not yet reflected in the ExpoConfig type definition
type ExpoConfigWithNewArch = ExpoConfig & {
  experiments?: ExpoConfig['experiments'] & { newArchEnabled?: boolean };
};

export default ({ config }: ConfigContext): ExpoConfigWithNewArch => ({
  ...config,
  name: 'Tracker',
  slug: 'tracker',
  version: '1.0.0',
  scheme: 'tracker',
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
    bundleIdentifier: 'com.personal.tracker',
  },
  android: {
    package: 'com.personal.tracker',
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
