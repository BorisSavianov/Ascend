import React, { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import Screen from '../../components/ui/Screen';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { colors, fontFamily, motion, radius, spacing, typography } from '../../lib/theme';

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

  // Wordmark entry
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkScale = useSharedValue(0.9);

  useEffect(() => {
    wordmarkOpacity.value = withTiming(1, { duration: motion.deliberate });
    wordmarkScale.value = withSpring(1, motion.spring.gentle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ scale: wordmarkScale.value }],
  }));

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
          {/* Ambient glow blobs */}
          <View
            style={{
              position: 'absolute',
              top: 120,
              left: -60,
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: colors.accent.primaryGlow,
            }}
            pointerEvents="none"
          />
          <View
            style={{
              position: 'absolute',
              bottom: 100,
              right: -70,
              width: 280,
              height: 280,
              borderRadius: 140,
              backgroundColor: 'rgba(108, 182, 255, 0.05)',
            }}
            pointerEvents="none"
          />

          {/* Wordmark */}
          <Animated.View style={[{ marginBottom: spacing['3xl'] }, wordmarkStyle]}>
            <Text
              style={[
                typography.display,
                {
                  fontFamily: fontFamily.displayBold,
                  fontSize: 48,
                  lineHeight: 52,
                  letterSpacing: -0.5,
                },
              ]}
            >
              ASCEND
            </Text>
            <Text style={[typography.body, { marginTop: spacing.sm, maxWidth: 260, color: colors.text.tertiary }]}>
              Precision tracking, calmer rhythm.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(motion.deliberate).delay(120)}>
            <Surface elevated overlay>
              {sent ? (
                <View style={{ gap: spacing.lg }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: radius.pill,
                      backgroundColor: 'rgba(48, 209, 88, 0.12)',
                      borderWidth: 1,
                      borderColor: colors.semantic.success,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="mail-outline" size={24} color={colors.semantic.success} />
                  </View>
                  <View>
                    <Text style={typography.h2}>Check your inbox</Text>
                    <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                      Your sign-in link is on its way. Open it on this device to continue.
                    </Text>
                  </View>
                  <View
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.semantic.success,
                      backgroundColor: 'rgba(48, 209, 88, 0.08)',
                    }}
                  >
                    <Text style={[typography.caption, { color: colors.semantic.success, fontFamily: fontFamily.monoRegular }]}>
                      {email.trim()}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: spacing.lg }}>
                  <View>
                    <Text style={typography.h2}>Sign in</Text>
                    <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                      Enter your email to receive a secure magic link.
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
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
