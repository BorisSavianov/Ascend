// hooks/usePushToken.ts
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export function usePushToken() {
  useEffect(() => {
    void registerToken();
  }, []);
}

async function registerToken() {
  if (Platform.OS === 'web') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  let tokenData: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync();
  } catch {
    return; // Physical device required; silently skip in simulator
  }

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return;

  await supabase.from('user_push_tokens').upsert({
    user_id: session.session.user.id,
    expo_token: tokenData.data,
    updated_at: new Date().toISOString(),
  });
}
