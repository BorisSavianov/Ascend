import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useGeminiChat, type ChatMessage } from '../../hooks/useGeminiChat';
import { QUICK_PROMPTS } from '../../constants/prompts';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Chip from '../../components/ui/Chip';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import BottomActionBar from '../../components/ui/BottomActionBar';
import { colors, spacing, typography } from '../../lib/theme';

function StreamingDots() {
  const values = useRef(
    [new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)],
  ).current;

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [values]);

  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingVertical: spacing.xs }}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: colors.text.secondary,
            opacity: value,
          }}
        />
      ))}
    </View>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View
      style={{
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: spacing.md,
        marginHorizontal: spacing.xl,
      }}
    >
      <View
        style={{
          maxWidth: '84%',
          backgroundColor: isUser ? colors.accent.primaryMuted : colors.bg.surfaceRaised,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isUser ? colors.accent.primary : colors.border.default,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        {message.isStreaming && message.content === '' ? (
          <StreamingDots />
        ) : (
          <Text
            style={[
              typography.bodySm,
              {
                color: colors.text.primary,
              },
            ]}
          >
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Surface
      style={{
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        borderColor: colors.semantic.danger,
        backgroundColor: 'rgba(240, 106, 106, 0.10)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={[typography.bodySm, { color: colors.semantic.danger, flex: 1 }]}>
          {message}
        </Text>
        <Pressable onPress={onDismiss}>
          <Ionicons name="close" size={18} color={colors.semantic.danger} />
        </Pressable>
      </View>
    </Surface>
  );
}

export default function InsightsScreen() {
  return (
    <ErrorBoundary fallbackLabel="Failed to load insights">
      <InsightsScreenContent />
    </ErrorBoundary>
  );
}

function InsightsScreenContent() {
  const { messages, isStreaming, error, sendMessage, clearMessages, clearError } = useGeminiChat();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  function handleSend() {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText('');
    void sendMessage(text);
  }

  function handleQuickPrompt(prompt: string) {
    if (isStreaming) return;
    void sendMessage(prompt);
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1 }}>
        <AppHeader
          title="Insights"
          subtitle="Ask for patterns, summaries, and anomalies without leaving the product’s quieter visual rhythm."
          trailing={
            messages.length > 0 ? (
              <Button label="Clear" onPress={clearMessages} variant="ghost" size="md" />
            ) : undefined
          }
        />

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
            flexGrow: messages.length === 0 ? 1 : 0,
          }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: spacing.xl,
              }}
            >
              <Surface elevated>
                <Text style={typography.h3}>Ask about your recent patterns</Text>
                <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                  The assistant can summarize nutrition trends, compare weeks, and highlight unusual days.
                </Text>
              </Surface>
            </View>
          }
        />

        {error ? (
          <ErrorBanner message={error} onDismiss={clearError} />
        ) : null}

        {messages.length === 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.md,
              gap: spacing.sm,
            }}
          >
            {QUICK_PROMPTS.map((prompt) => (
              <Chip
                key={prompt}
                label={prompt}
                onPress={() => handleQuickPrompt(prompt)}
              />
            ))}
          </ScrollView>
        ) : null}

        <BottomActionBar
          style={{
            paddingTop: spacing.sm,
          }}
        >
          <Surface overlay elevated style={{ padding: spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: spacing.md,
              }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask anything about your nutrition data"
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={1}
                style={[
                  typography.body,
                  {
                    flex: 1,
                    color: colors.text.primary,
                    minHeight: 44,
                    maxHeight: 104,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                  },
                ]}
              />
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() || isStreaming}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !inputText.trim() || isStreaming }}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor:
                    !inputText.trim() || isStreaming
                      ? colors.bg.surfaceRaised
                      : colors.accent.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor:
                    !inputText.trim() || isStreaming
                      ? colors.border.default
                      : colors.accent.primary,
                }}
              >
                {isStreaming ? (
                  <ActivityIndicator size="small" color={colors.text.tertiary} />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={!inputText.trim() ? colors.text.tertiary : colors.bg.canvas}
                  />
                )}
              </Pressable>
            </View>
          </Surface>
        </BottomActionBar>
      </View>
    </Screen>
  );
}
