// components/ThreadSheet.tsx
import React from 'react';
import { Modal, View, Text, Pressable, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Button from './ui/Button';
import { colors, spacing, typography } from '../lib/theme';
import type { ThreadIndexEntry } from '../types/conversation';

type Props = {
  visible: boolean;
  threads: ThreadIndexEntry[];
  onClose: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onNewThread: () => void;
};

export default function ThreadSheet({
  visible,
  threads,
  onClose,
  onSelectThread,
  onDeleteThread,
  onNewThread,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <Text style={typography.h3}>Conversations</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Button label="New conversation" onPress={onNewThread} />
        </View>

        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelectThread(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={typography.bodySm} numberOfLines={1}>
                  {item.title ?? 'Untitled conversation'}
                </Text>
                <Text style={[typography.caption, { marginTop: spacing.xs }]}>
                  {format(new Date(item.lastActive), 'd MMM yyyy')}
                </Text>
              </View>
              <Pressable
                onPress={() => onDeleteThread(item.id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ marginLeft: spacing.md }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.semantic.danger} />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl }}>
              <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                No past conversations.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
