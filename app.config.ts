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
    versionCode: 14,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
  },
  experiments: {
    newArchEnabled: true,
  },
  extra: {
    eas: {
      projectId: '9e8fb9c2-9767-4050-b61f-0584c7e18b72',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
