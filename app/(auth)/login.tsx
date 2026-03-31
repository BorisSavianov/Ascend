import React, { useState } from 'react';
import * as Linking from 'expo-linking';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import Screen from '../../components/ui/Screen';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { colors, spacing, typography } from '../../lib/theme';

type AuthWithOtp = {
  signInWithOtp: (creds: {
    email: string;
    options?: { emailRedirectTo?: string };
  }) => Promise<{ error: { message: string } | null }>;
};

const redirectTo = __DEV__
  ? Linking.createURL('')
  : Linking.createURL('', { scheme: 'ascend' });

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSendLink() {
    const trimmed = email.trim();
    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error } = await (supabase.auth as unknown as AuthWithOtp).signInWithOtp({
      email: trimmed,
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
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 140,
              left: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: colors.accent.primaryMuted,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 120,
              right: -50,
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: 'rgba(108, 182, 255, 0.08)',
            }}
          />

          <View style={{ marginBottom: spacing['3xl'] }}>
            <Text style={typography.display}>Ascend</Text>
            <Text style={[typography.body, { marginTop: spacing.sm, maxWidth: 280 }]}>
              Focused nutrition tracking with calmer visuals, clearer hierarchy, and a cleaner daily rhythm.
            </Text>
          </View>

          <Surface elevated overlay>
            {sent ? (
              <View>
                <Text style={typography.h2}>Check your inbox</Text>
                <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                  Your sign-in link is on its way. Open it on this device to continue into the app.
                </Text>
                <View
                  style={{
                    marginTop: spacing.xl,
                    padding: spacing.lg,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.semantic.success,
                    backgroundColor: 'rgba(71, 201, 126, 0.12)',
                  }}
                >
                  <Text style={[typography.bodySm, { color: colors.semantic.success }]}>
                    Sent to {email.trim()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: spacing.lg }}>
                <View>
                  <Text style={typography.h2}>Sign in</Text>
                  <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                    Enter your email and we’ll send a secure magic link.
                  </Text>
                </View>

                <TextField
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Email address"
                  error={errorMsg}
                  label="Email address"
                />

                <Button
                  label="Send login link"
                  onPress={() => { void handleSendLink(); }}
                  disabled={!email.trim()}
                  loading={loading}
                />
              </View>
            )}
          </Surface>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
