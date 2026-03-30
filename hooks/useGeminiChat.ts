// hooks/useGeminiChat.ts
import { useState, useCallback, useRef } from "react";
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

    await streamGeminiResponse(
      question,
      14,
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      () => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false };
          }
          return updated;
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
      },
      (err) => {
        setError(err.message);
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
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

  return { messages, isStreaming, error, sendMessage, clearMessages };
}
