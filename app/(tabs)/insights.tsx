import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import * as Clipboard from 'expo-clipboard';
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useConversation } from '../../hooks/useConversation';
import { usePushToken } from '../../hooks/usePushToken';
import { useProactiveInsight } from '../../hooks/useProactiveInsight';
import type { LocalMessage } from '../../types/conversation';
import { QUICK_PROMPTS, getRotatedPrompts } from '../../constants/prompts';
import Screen from '../../components/ui/Screen';
import AppHeader from '../../components/ui/AppHeader';
import Chip from '../../components/ui/Chip';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import BottomActionBar from '../../components/ui/BottomActionBar';
import PathBadge from '../../components/PathBadge';
import ThreadSheet from '../../components/ThreadSheet';
import ProactiveInsightBanner from '../../components/ProactiveInsightBanner';
import { colors, fontFamily, spacing, typography } from '../../lib/theme';

function StreamingDots() {
  const values = useRef(
    [new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)],
  ).current;

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [values]);

  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingVertical: spacing.xs }}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: colors.text.secondary,
            opacity: value,
          }}
        />
      ))}
    </View>
  );
}

function ChatBubble({ message }: { message: LocalMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={{ marginBottom: spacing.xs }}>
      <View
        style={{
          alignItems: isUser ? 'flex-end' : 'flex-start',
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
          {message.role === 'assistant' && message.content === '' ? (
            <StreamingDots />
          ) : isUser ? (
            <Text style={[typography.bodySm, { color: colors.text.primary }]}>
              {message.content}
            </Text>
          ) : (
            <Markdown
              style={{
                body: { ...typography.bodySm, color: colors.text.primary, margin: 0 },
                paragraph: { marginTop: 0, marginBottom: 4 },
                strong: { fontWeight: '700', color: colors.text.primary },
                em: { color: colors.text.primary },
                bullet_list: { marginVertical: 4 },
                ordered_list: { marginVertical: 4 },
                bullet_list_item: { color: colors.text.primary },
                ordered_list_item: { color: colors.text.primary },
                code_inline: { color: colors.text.primary },
                heading1: { color: colors.text.primary, marginVertical: 4, fontFamily: fontFamily.displayBold, fontSize: 22 },
                heading2: { color: colors.text.primary, marginVertical: 4, fontFamily: fontFamily.displaySemi, fontSize: 18 },
                heading3: { color: colors.text.primary, marginVertical: 4, fontFamily: fontFamily.displaySemi, fontSize: 15 },
              }}
            >
              {message.content}
            </Markdown>
          )}
        </View>
      </View>
      {message.role === 'assistant' && message.path === 'complex' && <PathBadge />}
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
  const [windowDays, setWindowDays] = useState(14);
  const [inputText, setInputText] = useState('');
  const [showThreadSheet, setShowThreadSheet] = useState(false);
  const [promptDomain, setPromptDomain] = useState<keyof typeof QUICK_PROMPTS>('nutrition');
  const flatListRef = useRef<FlatList<LocalMessage>>(null);

  const {
    messages,
    isStreaming,
    error,
    threadIndex,
    sendMessage,
    createNewThread,
    loadThread,
    deleteThread,
    clearError,
  } = useConversation(windowDays);

  usePushToken();
  const { insight, dismiss } = useProactiveInsight();

  // Rotate prompt domain on each mount
  useEffect(() => {
    const domains = Object.keys(QUICK_PROMPTS) as Array<keyof typeof QUICK_PROMPTS>;
    setPromptDomain(domains[Math.floor(Date.now() / 1000) % domains.length]);
  }, []);

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

  function handleCopyLast() {
    const last = messages.findLast((m) => m.role === 'assistant');
    if (last) void Clipboard.setStringAsync(last.content);
  }

  const windowOptions: Array<{ label: string; value: number }> = [
    { label: '7d', value: 7 },
    { label: '14d', value: 14 },
    { label: '30d', value: 30 },
  ];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1 }}>
        <AppHeader
          title="Fitness Assistant"
          trailing={
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="Threads"
                onPress={() => setShowThreadSheet(true)}
                variant="ghost"
                size="md"
              />
              <Button
                label="New"
                onPress={() => { void createNewThread(); }}
                variant="ghost"
                size="md"
              />
            </View>
          }
        />

        {insight ? (
          <ProactiveInsightBanner
            insight={insight}
            onDismiss={dismiss}
            onAskAboutThis={(question) => {
              setInputText('');
              void sendMessage(question);
            }}
          />
        ) : null}

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
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
              <Surface elevated>
                <Text style={typography.h3}>Ask about your fitness data</Text>
                <Text style={[typography.bodySm, { marginTop: spacing.sm }]}>
                  Ask about nutrition, training, body composition, or fasting — or across all of them together.
                </Text>
              </Surface>
            </View>
          }
        />

        {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
          }}
        >
          {getRotatedPrompts(promptDomain).map((prompt) => (
            <Chip
              key={prompt}
              label={prompt}
              onPress={() => handleQuickPrompt(prompt)}
            />
          ))}
        </ScrollView>

        <BottomActionBar style={{ paddingTop: spacing.sm }}>
          <Surface overlay elevated style={{ padding: spacing.md }}>
            {/* Window selector */}
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                marginBottom: spacing.sm,
                alignItems: 'center',
              }}
            >
              {windowOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setWindowDays(opt.value)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor:
                      windowDays === opt.value ? colors.accent.primary : colors.border.default,
                    backgroundColor:
                      windowDays === opt.value ? colors.accent.primaryMuted : 'transparent',
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color:
                          windowDays === opt.value ? colors.accent.primary : colors.text.secondary,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              {messages.some((m) => m.role === 'assistant') ? (
                <Pressable onPress={handleCopyLast}>
                  <Ionicons name="copy-outline" size={16} color={colors.text.tertiary} />
                </Pressable>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask anything about your fitness data"
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
                  <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        borderWidth: 2,
                        borderColor: colors.text.tertiary,
                        borderTopColor: 'transparent',
                      }}
                    />
                  </View>
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

      <ThreadSheet
        visible={showThreadSheet}
        threads={threadIndex}
        onClose={() => setShowThreadSheet(false)}
        onSelectThread={(id) => {
          void loadThread(id);
          setShowThreadSheet(false);
        }}
        onDeleteThread={(id) => {
          setShowThreadSheet(false); // close immediately to prevent double-tap race
          void deleteThread(id);
        }}
        onNewThread={() => {
          void createNewThread();
          setShowThreadSheet(false);
        }}
      />
    </Screen>
  );
}
