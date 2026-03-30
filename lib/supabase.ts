import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { AuthSession, AuthUser } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';
import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Session = AuthSession;
export type User = AuthUser;

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}

/**
 * SupabaseAuthClient's bundled declaration inherits GoTrueClient methods at
 * runtime but the bundled .d.ts doesn't expose them via TypeScript. This typed
 * wrapper surfaces the subset of auth methods used throughout this app.
 */
export const auth = supabase.auth as unknown as {
  getSession(): Promise<{ data: { session: Session | null }; error: Error | null }>;
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } };
  signInWithOtp(credentials: { email: string; options?: { emailRedirectTo?: string } }): Promise<{ error: { message: string } | null }>;
  setSession(params: { access_token: string; refresh_token: string }): Promise<{ data: { session: Session | null }; error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
};
