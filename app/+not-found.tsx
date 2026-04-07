import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function NotFound() {
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      router.replace(session ? '/(tabs)/log' : '/(auth)/login');
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return <View />;
}
