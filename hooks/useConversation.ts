// hooks/useConversation.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { sendMessage as apiSendMessage } from '../lib/gemini';
import { useAppStore } from '../store/useAppStore';
import type { LocalThread, LocalMessage, ThreadIndexEntry } from '../types/conversation';

const ACTIVE_THREAD_KEY = '@ai_active_thread';
const THREAD_INDEX_KEY = '@ai_thread_index';
const threadKey = (id: string) => `@ai_thread_${id}`;
const MAX_LOCAL_THREADS = 10;
const MAX_LOCAL_MESSAGES = 30;

/**
 * Removes all conversation-related AsyncStorage entries for the current device.
 * Call on sign-out to prevent data leakage to the next user who logs in.
 */
export async function clearConversationCache(): Promise<void> {
  try {
    const indexStr = await AsyncStorage.getItem(THREAD_INDEX_KEY);
    const keys: string[] = [ACTIVE_THREAD_KEY, THREAD_INDEX_KEY];
    if (indexStr) {
      try {
        const index: ThreadIndexEntry[] = JSON.parse(indexStr) as ThreadIndexEntry[];
        keys.push(...index.map((e) => threadKey(e.id)));
      } catch {
        // corrupt index — still remove base keys below
      }
    }
    await AsyncStorage.multiRemove(keys);
  } catch {
    // best-effort cleanup; non-fatal
  }
}

// randomUUID() is not available in all RN/Expo Go environments
function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useConversation(windowDays: number) {
  const [thread, setThread] = useState<LocalThread | null>(null);
  const [threadIndex, setThreadIndex] = useState<ThreadIndexEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStreamingRef = useRef(false);
  const pendingChunkRef = useRef('');
  const rafHandleRef = useRef<number | null>(null);
  // Ref so sendMessage always reads the latest windowDays without re-creating the callback
  const windowDaysRef = useRef(windowDays);
  windowDaysRef.current = windowDays;

  const calorieTarget = useAppStore((s) => s.calorieTarget);
  const macroTargets = useAppStore((s) => s.macroTargets);
  const fastingTargetHours = useAppStore((s) => s.fastingTargetHours);

  useEffect(() => {
    void loadActiveThread();
    return () => {
      if (rafHandleRef.current !== null) cancelAnimationFrame(rafHandleRef.current);
    };
  }, []);

  async function loadActiveThread() {
    console.log('[loadActiveThread] start');
    try {
      const [activeId, indexStr] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_THREAD_KEY),
        AsyncStorage.getItem(THREAD_INDEX_KEY),
      ]);
      console.log('[loadActiveThread] activeId:', activeId, 'hasIndex:', !!indexStr);
      if (indexStr) setThreadIndex(JSON.parse(indexStr));
      if (activeId) {
        const stored = await AsyncStorage.getItem(threadKey(activeId));
        console.log('[loadActiveThread] stored thread:', !!stored);
        if (stored) {
          setThread(JSON.parse(stored));
          void syncThreadFromSupabase(activeId);
          void syncThreadIndexFromSupabase();
          return;
        }
      }
    } catch (e) {
      console.log('[loadActiveThread] ERROR:', String(e));
    }
    console.log('[loadActiveThread] calling createNewThread');
    await createNewThread();
    void syncThreadIndexFromSupabase();
  }

  async function syncThreadFromSupabase(threadId: string) {
    try {
      const [messagesRes, threadRes] = await Promise.all([
        supabase
          .from('ai_messages')
          .select('id, role, content, path, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .limit(MAX_LOCAL_MESSAGES),
        supabase
          .from('ai_threads')
          .select('id, title, last_active')
          .eq('id', threadId)
          .maybeSingle(),
      ]);
      if (!threadRes.data) return;

      const synced: LocalThread = {
        id: threadRes.data.id,
        title: threadRes.data.title,
        lastActive: threadRes.data.last_active,
        messages: (messagesRes.data ?? []).map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          path: (m.path ?? undefined) as 'simple' | 'complex' | undefined,
          createdAt: m.created_at,
        })),
      };
      await AsyncStorage.setItem(threadKey(threadId), JSON.stringify(synced));
      setThread(synced);
      updateThreadIndex({ id: synced.id, title: synced.title, lastActive: synced.lastActive });
    } catch (e) {
      console.warn('[syncThreadFromSupabase] sync failed for thread', threadId, String(e));
    }
  }

  async function syncThreadIndexFromSupabase() {
    try {
      const { data: threads } = await supabase
        .from('ai_threads')
        .select('id, title, last_active')
        .order('last_active', { ascending: false })
        .limit(MAX_LOCAL_THREADS);
      if (!threads?.length) return;
      const entries: ThreadIndexEntry[] = threads.map((t) => ({
        id: t.id,
        title: t.title,
        lastActive: t.last_active,
      }));
      setThreadIndex(entries);
      await AsyncStorage.setItem(THREAD_INDEX_KEY, JSON.stringify(entries));
    } catch { /* background sync — local index already displayed */ }
  }

  // Uses functional setState to avoid AsyncStorage read-modify-write races
  function updateThreadIndex(entry: ThreadIndexEntry) {
    setThreadIndex((prev) => {
      const filtered = prev.filter((e) => e.id !== entry.id);
      const updated = [entry, ...filtered];
      void AsyncStorage.setItem(THREAD_INDEX_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  const createNewThread = useCallback(async () => {
    console.log('[createNewThread] start');
    try {
    const id = randomUUID();
    console.log('[createNewThread] id ok:', id.slice(0, 8));
    const now = new Date().toISOString();
    const newThread: LocalThread = { id, title: null, lastActive: now, messages: [] };

    // Use functional update so we read latest state — avoids AsyncStorage read race.
    // All AsyncStorage side-effects (removeItem + setItem) are initiated inside the
    // closure so they use the correct evicted ID, not a captured outer variable.
    setThreadIndex((prev) => {
      const evictedId = prev.length >= MAX_LOCAL_THREADS ? prev[prev.length - 1].id : null;
      if (evictedId) void AsyncStorage.removeItem(threadKey(evictedId));
      const trimmed = evictedId ? prev.slice(0, -1) : prev;
      const finalIndex = [{ id, title: null, lastActive: now }, ...trimmed];
      void AsyncStorage.setItem(THREAD_INDEX_KEY, JSON.stringify(finalIndex));
      return finalIndex;
    });

    // Set thread state immediately — don't block on AsyncStorage writes.
    // AsyncStorage.setItem hangs on some devices/environments; persistence is best-effort.
    setThread(newThread);
    void AsyncStorage.setItem(threadKey(id), JSON.stringify(newThread));
    void AsyncStorage.setItem(ACTIVE_THREAD_KEY, id);
    console.log('[createNewThread] done, thread set:', id);
    } catch (e) {
      console.log('[createNewThread] THREW:', String(e));
    }
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    void AsyncStorage.setItem(ACTIVE_THREAD_KEY, threadId);
    const stored = await AsyncStorage.getItem(threadKey(threadId));
    if (stored) {
      setThread(JSON.parse(stored));
    } else {
      // No cached data yet — clear UI while Supabase sync runs
      setThread({ id: threadId, title: null, lastActive: new Date().toISOString(), messages: [] });
    }
    void syncThreadFromSupabase(threadId);
  }, []);

  const deleteThread = useCallback(async (threadId: string) => {
    void AsyncStorage.removeItem(threadKey(threadId));
    let updatedIndex: ThreadIndexEntry[] = [];
    setThreadIndex((prev) => {
      updatedIndex = prev.filter((e) => e.id !== threadId);
      void AsyncStorage.setItem(THREAD_INDEX_KEY, JSON.stringify(updatedIndex));
      return updatedIndex;
    });
    // Delete from Supabase (cascade deletes messages); best-effort
    await supabase.from('ai_threads').delete().eq('id', threadId).then(() => {}, () => {});
    // If we deleted the active thread, create a new one
    const activeId = await AsyncStorage.getItem(ACTIVE_THREAD_KEY);
    if (activeId === threadId) {
      if (updatedIndex.length > 0) {
        await loadThread(updatedIndex[0].id);
      } else {
        await createNewThread();
      }
    }
  }, [createNewThread, loadThread]);

  const sendMessage = useCallback(async (question: string) => {
    console.log('[sendMessage] called, thread:', thread?.id ?? 'NULL', 'isStreamingRef:', isStreamingRef.current);
    if (isStreamingRef.current || !thread) return;
    setError(null);

    // Capture thread ID at call time — used for all storage writes in callbacks below.
    // Using a captured ID (not prev.id) prevents writing streaming content into a different
    // thread if the user switches threads while the stream is in flight.
    const streamingThreadId = thread.id;

    const userMsg: LocalMessage = {
      id: randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: LocalMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    const optimisticThread: LocalThread = {
      ...thread,
      lastActive: new Date().toISOString(),
      messages: [...thread.messages, userMsg, assistantMsg],
    };
    setThread(optimisticThread);
    void AsyncStorage.setItem(threadKey(streamingThreadId), JSON.stringify(optimisticThread));

    isStreamingRef.current = true;
    setIsStreaming(true);

    function flushPendingChunk() {
      const chunk = pendingChunkRef.current;
      if (!chunk) return;
      pendingChunkRef.current = '';
      rafHandleRef.current = null;
      setThread((prev) => {
        if (!prev) return prev;
        const msgs = [...prev.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
        }
        return { ...prev, messages: msgs };
      });
    }

    try {
    await apiSendMessage({
      threadId: streamingThreadId,
      message: question,
      windowDays: windowDaysRef.current,
      userTargets: { calorieTarget, macroTargets, fastingTargetHours },
      onChunk: (chunk) => {
        pendingChunkRef.current += chunk;
        if (rafHandleRef.current === null) {
          rafHandleRef.current = requestAnimationFrame(flushPendingChunk);
        }
      },
      onComplete: (path) => {
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        const remaining = pendingChunkRef.current;
        pendingChunkRef.current = '';
        setThread((prev) => {
          if (!prev) return prev;
          const msgs = [...prev.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: last.content + remaining, path };
          }
          const next = { ...prev, messages: msgs };
          void AsyncStorage.setItem(threadKey(streamingThreadId), JSON.stringify(next));
          return next;
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
        // Sync title from Supabase (Edge Function sets it on first message)
        void syncThreadTitleFromSupabase(streamingThreadId);
      },
      onError: (err) => {
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        pendingChunkRef.current = '';
        setError(err.message);
        setThread((prev) => {
          if (!prev) return prev;
          const msgs = [...prev.messages];
          if (msgs[msgs.length - 1]?.role === 'assistant') msgs.pop();
          const next = { ...prev, messages: msgs };
          // Sync corrected state back to AsyncStorage to remove the dangling assistant placeholder
          void AsyncStorage.setItem(threadKey(streamingThreadId), JSON.stringify(next));
          return next;
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
      },
    });
    } catch (err) {
      // Safety net: if apiSendMessage throws rather than calling onError,
      // reset streaming state so future sends are not permanently blocked.
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }
      pendingChunkRef.current = '';
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setThread((prev) => {
        if (!prev) return prev;
        const msgs = [...prev.messages];
        if (msgs[msgs.length - 1]?.role === 'assistant') msgs.pop();
        const next = { ...prev, messages: msgs };
        void AsyncStorage.setItem(threadKey(streamingThreadId), JSON.stringify(next));
        return next;
      });
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  }, [thread, calorieTarget, macroTargets, fastingTargetHours]);

  async function syncThreadTitleFromSupabase(threadId: string) {
    try {
      const { data } = await supabase
        .from('ai_threads')
        .select('title')
        .eq('id', threadId)
        .maybeSingle();
      if (data?.title) {
        setThread((prev) => (prev ? { ...prev, title: data.title } : prev));
        updateThreadIndex({
          id: threadId,
          title: data.title,
          lastActive: new Date().toISOString(),
        });
      }
    } catch { /* title sync is best-effort */ }
  }

  const clearError = useCallback(() => setError(null), []);

  return {
    thread,
    messages: thread?.messages ?? [],
    isStreaming,
    error,
    threadIndex,
    sendMessage,
    createNewThread,
    loadThread,
    deleteThread,
    clearError,
  };
}
