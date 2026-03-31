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
import OfflineBanner from '../components/OfflineBanner';
import {
  requestNotificationPermissions,
  getStoredNotificationConfig,
  getStoredCustomReminders,
  ensureDailyRemindersScheduled,
} from '../lib/notifications';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../lib/theme';

// Keep splash screen visible until session check resolves
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isMounted = useRef(false);
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
      await SplashScreen.hideAsync();

      if (!isMounted.current) return;

      if (session) {
        await seedFoodsIfEmpty(session.user.id);
        const granted = await requestNotificationPermissions();
        if (granted) {
          const config = await getStoredNotificationConfig();
          const custom = await getStoredCustomReminders();
          await ensureDailyRemindersScheduled(config, custom);
        }
        router.replace('/(tabs)/log');
      } else {
        router.replace('/(auth)/login');
      }
    }

    void initAuth();

    // Handle deep links when app is already open (foreground)
    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      void processDeepLinkUrl(url);
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !isMounted.current) return;
      void (async () => {
        const granted = await requestNotificationPermissions();
        if (!granted) return;
        const { notificationConfig, customReminders } = useAppStore.getState();
        await ensureDailyRemindersScheduled(notificationConfig, customReminders);
      })();
    });

    const { data: { subscription } } = auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted.current) return;
        if (session) {
          void seedFoodsIfEmpty(session.user.id).then(async () => {
            const granted = await requestNotificationPermissions();
            if (granted) {
              const config = await getStoredNotificationConfig();
              const custom = await getStoredCustomReminders();
              await ensureDailyRemindersScheduled(config, custom);
            }
            router.replace('/(tabs)/log');
          }).catch((err) => {
            if (__DEV__) console.warn('Auth init error:', err);
            router.replace('/(tabs)/log');
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

  if (__DEV__) console.log('Processing magic link tokens');

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error && __DEV__) console.warn('setSession error:', error.message);
}

async function seedFoodsIfEmpty(userId: string): Promise<void> {
  const { count, error } = await supabase
    .from('foods')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    if (__DEV__) console.warn('Seed check error:', error.message);
    return;
  }

  if ((count ?? 0) === 0) {
    const { error: seedError } = await supabase.rpc('seed_personal_foods', {
      p_user_id: userId,
    });
    if (seedError && __DEV__) {
      console.warn('Seed error:', seedError.message);
    }
  }
}
