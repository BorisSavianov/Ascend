// app/(tabs)/insights.tsx
import React, { useState, useRef } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGeminiChat, type ChatMessage } from '../../hooks/useGeminiChat';
import { QUICK_PROMPTS } from '../../constants/prompts';

// ── Animated dots for streaming placeholder ──────────────────────────────────

function StreamingDots() {
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#6b7280',
            opacity: 0.6,
          }}
        />
      ))}
    </View>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View
      style={{
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
        marginHorizontal: 16,
      }}
    >
      <View
        style={{
          maxWidth: '82%',
          backgroundColor: isUser ? '#16a34a' : '#111827',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        {message.isStreaming && message.content === '' ? (
          <StreamingDots />
        ) : (
          <Text style={{ color: isUser ? '#ffffff' : '#d1d5db', fontSize: 15, lineHeight: 22 }}>
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#450a0a',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: '#fca5a5', fontSize: 13, flex: 1 }}>{message}</Text>
      <Pressable onPress={onDismiss} style={{ marginLeft: 8 }}>
        <Text style={{ color: '#f87171', fontSize: 16, fontWeight: '700' }}>✕</Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030712' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700' }}>Insights</Text>
        {messages.length > 0 ? (
          <Pressable onPress={clearMessages}>
            <Text style={{ color: '#6b7280', fontSize: 14 }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#374151', fontSize: 14 }}>Ask anything about your nutrition data.</Text>
          </View>
        }
      />

      {/* Error banner */}
      {error ? (
        <ErrorBanner
          message={error}
          onDismiss={clearError}
        />
      ) : null}

      {/* Quick prompts — shown only when no messages */}
      {messages.length === 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
        >
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => handleQuickPrompt(prompt)}
              accessibilityRole="button"
              accessibilityLabel={prompt}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1f2937' : '#111827',
                borderWidth: 1,
                borderColor: '#374151',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
              })}
            >
              <Text style={{ color: '#c4c9d4', fontSize: 13 }}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Input row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          paddingBottom: 12,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#1f2937',
          gap: 10,
        }}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask anything..."
          placeholderTextColor="#4b5563"
          multiline
          numberOfLines={1}
          style={{
            flex: 1,
            backgroundColor: '#111827',
            color: '#ffffff',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            maxHeight: 100,
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isStreaming}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !inputText.trim() || isStreaming }}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor:
              !inputText.trim() || isStreaming ? '#1f2937' : pressed ? '#16a34a' : '#22c55e',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {isStreaming ? (
            <ActivityIndicator size="small" color="#6b7280" />
          ) : (
            <Text style={{ color: !inputText.trim() ? '#6b7280' : '#000000', fontSize: 18, fontWeight: '700' }}>
              ↑
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
