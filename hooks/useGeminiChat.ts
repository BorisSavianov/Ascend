// hooks/useGeminiChat.ts
import { useState, useCallback, useRef, useEffect } from "react";
import { streamGeminiResponse } from "@/lib/gemini";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

let _msgId = 0;
const nextId = () => String(++_msgId);

export function useGeminiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStreamingRef = useRef(false);
  // Accumulate streaming chunks in a ref; flush to state via rAF to reduce re-renders
  const pendingChunkRef = useRef<string>('');
  const rafHandleRef = useRef<number | null>(null);

  // Clean up any pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rafHandleRef.current !== null) cancelAnimationFrame(rafHandleRef.current);
    };
  }, []);

  const sendMessage = useCallback(async (question: string) => {
    if (isStreamingRef.current) return;
    setError(null);

    const userMessage: ChatMessage = {
      id: nextId(),
      role: "user",
      content: question,
    };

    const assistantMessage: ChatMessage = {
      id: nextId(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    isStreamingRef.current = true;
    setIsStreaming(true);

    function flushPendingChunk() {
      const chunk = pendingChunkRef.current;
      if (!chunk) return;
      pendingChunkRef.current = '';
      rafHandleRef.current = null;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
        }
        return updated;
      });
    }

    await streamGeminiResponse(
      question,
      14,
      (chunk) => {
        // Accumulate chunk and schedule a single rAF flush
        pendingChunkRef.current += chunk;
        if (rafHandleRef.current === null) {
          rafHandleRef.current = requestAnimationFrame(flushPendingChunk);
        }
      },
      () => {
        // Flush any remaining buffered content before marking done
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        const remaining = pendingChunkRef.current;
        pendingChunkRef.current = '';
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + remaining,
              isStreaming: false,
            };
          }
          return updated;
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
      },
      (err) => {
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        pendingChunkRef.current = '';
        setError(err.message);
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated.pop();
          }
          return updated;
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
      }
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { messages, isStreaming, error, sendMessage, clearMessages, clearError };
}
