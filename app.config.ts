import type { ExpoConfig, ConfigContext } from 'expo/config';

// newArchEnabled is valid in Expo SDK 52 but not yet reflected in the ExpoConfig type definition
type ExpoConfigWithNewArch = ExpoConfig & {
  experiments?: ExpoConfig['experiments'] & { newArchEnabled?: boolean };
};

function resolveIntegerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default ({ config }: ConfigContext): ExpoConfigWithNewArch => ({
  ...config,
  name: 'Ascend',
  slug: 'ascend',
  version: process.env.APP_VERSION ?? '1.0.0',
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
    versionCode: resolveIntegerEnv(process.env.APP_ANDROID_VERSION_CODE, 14),
    permissions: ['REQUEST_INSTALL_PACKAGES'],
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
    update: {
      githubOwner: process.env.EXPO_PUBLIC_GITHUB_OWNER,
      githubRepo: process.env.EXPO_PUBLIC_GITHUB_REPO,
      checkIntervalMs: resolveIntegerEnv(process.env.EXPO_PUBLIC_UPDATE_CHECK_INTERVAL_MS, 6 * 60 * 60 * 1000),
      snoozeMs: resolveIntegerEnv(process.env.EXPO_PUBLIC_UPDATE_SNOOZE_MS, 24 * 60 * 60 * 1000),
      requestTimeoutMs: resolveIntegerEnv(process.env.EXPO_PUBLIC_UPDATE_REQUEST_TIMEOUT_MS, 15_000),
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
