import React, { useState } from 'react';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

// SupabaseAuthClient inherits GoTrueClient methods at runtime but the bundled
// type declaration omits them. Use a minimal local interface for the OTP call.
type AuthWithOtp = {
  signInWithOtp: (creds: {
    email: string;
    options?: { emailRedirectTo?: string };
  }) => Promise<{ error: { message: string } | null }>;
};

// In Expo Go (__DEV__), use the exp:// URL so deep links work without a build.
// In production builds, use the custom tracker:// scheme.
const redirectTo = __DEV__
  ? Linking.createURL('')
  : Linking.createURL('', { scheme: 'tracker' });

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


  async function handleSendLink() {
    if (!email.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    // Show the redirect URL for debugging (remove after confirming it works)
    if (__DEV__) {
      console.log('OTP redirect URL:', redirectTo);
      Alert.alert('Debug: Redirect URL', redirectTo);
    }

    const { error } = await (supabase.auth as unknown as AuthWithOtp).signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-950"
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-white text-3xl font-bold mb-2">Tracker</Text>
        <Text className="text-gray-400 text-base mb-10">
          Sign in to your account
        </Text>

        {sent ? (
          <View className="bg-green-900 border border-green-700 rounded-xl p-4">
            <Text className="text-green-300 text-base text-center">
              Check your email for a login link.
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#6b7280"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-gray-800 text-white rounded-xl px-4 py-4 text-base mb-4"
            />

            {errorMsg ? (
              <Text className="text-red-400 text-sm mb-4">{errorMsg}</Text>
            ) : null}

            <Pressable
              onPress={() => { void handleSendLink(); }}
              disabled={loading || !email.trim()}
              className={`rounded-xl py-4 items-center ${
                loading || !email.trim() ? 'bg-gray-700' : 'bg-green-600'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Send Login Link
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
