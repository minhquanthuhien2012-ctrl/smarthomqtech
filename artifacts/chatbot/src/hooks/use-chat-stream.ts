import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAnthropicMessagesQueryKey } from "@workspace/api-client-react";

interface StreamMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolCalls?: { name: string; status: string }[];
}

export function useChatStream(conversationId: number | null) {
  const [streamedMessage, setStreamedMessage] = useState<StreamMessage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId) return;

    setIsStreaming(true);
    setStreamedMessage({ role: "assistant", content: "", isStreaming: true, toolCalls: [] });

    abortControllerRef.current = new AbortController();

    try {
      const BASE = import.meta.env.BASE_URL;
      const response = await fetch(`${BASE}api/anthropic/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let currentContent = "";
      let currentToolCalls: { name: string; status: string }[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                currentContent += data.content;
                setStreamedMessage({
                  role: "assistant",
                  content: currentContent,
                  isStreaming: true,
                  toolCalls: currentToolCalls,
                });
              } else if (data.tool_call) {
                currentToolCalls = [...currentToolCalls, data.tool_call];
                setStreamedMessage({
                  role: "assistant",
                  content: currentContent,
                  isStreaming: true,
                  toolCalls: currentToolCalls,
                });
              } else if (data.done) {
                // Done
              } else if (data.error) {
                console.error("Stream error:", data.error);
              }
            } catch (e) {
              console.error("Failed to parse SSE data", e);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Stream aborted");
      } else {
        console.error("Error streaming message:", error);
      }
    } finally {
      setIsStreaming(false);
      setStreamedMessage(null);
      queryClient.invalidateQueries({
        queryKey: getListAnthropicMessagesQueryKey(conversationId),
      });
    }
  }, [conversationId, queryClient]);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return { sendMessage, streamedMessage, isStreaming, stopStreaming };
}
