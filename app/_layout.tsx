import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Slot } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase, auth } from '../lib/supabase';
import { logger } from '../lib/logger';
import OfflineBanner from '../components/OfflineBanner';
import {
  requestNotificationPermissions,
  getStoredNotificationConfig,
  getStoredCustomReminders,
  ensureDailyRemindersScheduled,
  ensureFastNearEndReminderScheduled,
} from '../lib/notifications';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../lib/theme';

// Font loading
import { useFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';

// Keep splash screen visible until session check resolves
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isMounted = useRef(false);
  // Tracks whether initAuth() has completed its first run. The onAuthStateChange
  // listener fires immediately if a session exists, which would race with
  // initAuth. We skip the listener's first event until initAuth is done.
  const initDoneRef = useRef(false);

  // Track whether fonts have loaded so we can gate SplashScreen.hideAsync()
  const fontsReadyRef = useRef(false);
  // Track whether auth has resolved so we can gate SplashScreen.hideAsync()
  const authReadyRef = useRef(false);

  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  // Once fonts load, attempt to hide splash (both conditions must be true)
  useEffect(() => {
    if (fontsLoaded) {
      fontsReadyRef.current = true;
      if (authReadyRef.current) {
        void SplashScreen.hideAsync();
      }
    }
  }, [fontsLoaded]);

  // Create QueryClient inside the component so it is bound to React's lifecycle.
  // Using useRef ensures a single stable instance across re-renders without
  // leaking across auth transitions (we call queryClient.clear() on sign-out).
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: { queries: { retry: 1 } },
    });
  }
  const queryClient = queryClientRef.current;

  useEffect(() => {
    isMounted.current = true;
    void SystemUI.setBackgroundColorAsync(colors.bg.canvas);

    async function initAuth() {
      // Check if app was cold-started from a magic link and process tokens first
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await processDeepLinkUrl(initialUrl);
      }

      const { data: { session } } = await auth.getSession();

      // Signal auth readiness; hide splash only when fonts are also loaded
      authReadyRef.current = true;
      if (fontsReadyRef.current) {
        await SplashScreen.hideAsync();
      }

      if (!isMounted.current) return;

      if (session) {
        await seedFoodsIfEmpty(session.user.id);
        await seedWorkoutPresetsIfEmpty(session.user.id);
        // Warm the frequent-foods cache so LogScreen renders instantly
        void queryClient.prefetchQuery({
          queryKey: ['frequent_foods'],
          queryFn: async () => {
            const { data } = await supabase
              .from('foods')
              .select('*')
              .eq('user_id', session.user.id)
              .order('use_count', { ascending: false })
              .limit(10);
            return data ?? [];
          },
          staleTime: 5 * 60 * 1000,
        });
        const granted = await requestNotificationPermissions();
        if (granted) {
          const config = await getStoredNotificationConfig();
          const custom = await getStoredCustomReminders();
          await ensureDailyRemindersScheduled(config, custom);
          await ensureFastNearEndReminderScheduled(
            useAppStore.getState().fastingNearEndReminderEnabled,
          );
        }
        router.replace('/(tabs)/today');
      } else {
        router.replace('/(auth)/login');
      }

      // Signal that initAuth has finished so the auth listener can take over
      initDoneRef.current = true;
    }

    void initAuth().catch((err) => {
      logger.warn('initAuth error:', err);
      initDoneRef.current = true;
      // Ensure splash hides even on error
      authReadyRef.current = true;
      void SplashScreen.hideAsync();
    });

    // Handle deep links when app is already open (foreground)
    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      void processDeepLinkUrl(url).catch((err) => {
        logger.warn('processDeepLinkUrl error:', err);
      });
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !isMounted.current) return;
      void (async () => {
        const granted = await requestNotificationPermissions();
        if (!granted) return;
        const {
          notificationConfig,
          customReminders,
          fastingNearEndReminderEnabled,
        } = useAppStore.getState();
        await ensureDailyRemindersScheduled(notificationConfig, customReminders);
        await ensureFastNearEndReminderScheduled(fastingNearEndReminderEnabled);
      })();
    });

    const { data: { subscription } } = auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted.current) return;
        // Skip the initial synchronous event that fires before initAuth completes
        // to avoid double-navigation and double-seeding on cold start.
        if (!initDoneRef.current) return;
        if (session) {
          void Promise.all([
        seedFoodsIfEmpty(session.user.id),
        seedWorkoutPresetsIfEmpty(session.user.id),
      ]).then(async () => {
            // Warm frequent-foods cache on sign-in
            void queryClient.prefetchQuery({
              queryKey: ['frequent_foods'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('foods')
                  .select('*')
                  .eq('user_id', session.user.id)
                  .order('use_count', { ascending: false })
                  .limit(10);
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            const granted = await requestNotificationPermissions();
            if (granted) {
              const config = await getStoredNotificationConfig();
              const custom = await getStoredCustomReminders();
              await ensureDailyRemindersScheduled(config, custom);
              await ensureFastNearEndReminderScheduled(
                useAppStore.getState().fastingNearEndReminderEnabled,
              );
            }
            router.replace('/(tabs)/today');
          }).catch((err) => {
            logger.warn('Auth init error:', err);
            router.replace('/(tabs)/today');
          });
        } else {
          router.replace('/(auth)/login');
        }
      },
    );

    return () => {
      isMounted.current = false;
      linkingSub.remove();
      appStateSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <OfflineBanner />
        <Slot />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

async function processDeepLinkUrl(url: string): Promise<void> {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (hashIndex === -1 && queryIndex === -1) return;

  const fragment = hashIndex !== -1
    ? url.substring(hashIndex + 1)
    : url.substring(queryIndex + 1);
  const params = Object.fromEntries(new URLSearchParams(fragment));

  const { access_token, refresh_token } = params;
  if (!access_token) return;

  logger.log('Processing magic link tokens');

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) logger.warn('setSession error:', error.message);
}

async function seedWorkoutPresetsIfEmpty(userId: string): Promise<void> {
  const { count, error } = await supabase
    .from('workout_presets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    logger.warn('Workout preset seed check error:', error.message);
    return;
  }

  if ((count ?? 0) === 0) {
    const { error: seedError } = await supabase.rpc('seed_workout_presets', {
      p_user_id: userId,
    });
    if (seedError) {
      logger.warn('Workout preset seed error:', seedError.message);
    }
  }
}

async function seedFoodsIfEmpty(userId: string): Promise<void> {
  const { count, error } = await supabase
    .from('foods')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    logger.warn('Seed check error:', error.message);
    return;
  }

  if ((count ?? 0) === 0) {
    const { error: seedError } = await supabase.rpc('seed_personal_foods', {
      p_user_id: userId,
    });
    if (seedError) {
      logger.warn('Seed error:', seedError.message);
    }
  }
}
