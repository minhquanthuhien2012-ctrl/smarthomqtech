import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  useListAnthropicMessages,
  getListAnthropicMessagesQueryKey,
  useCreateAnthropicConversation,
  getListAnthropicConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface ChatAreaProps {
  conversationId: number | null;
  onConversationCreated: (id: number) => void;
}

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ToolCall {
  name: string;
  status: "starting" | "running" | "done" | "error";
}

const TOOL_LABELS: Record<string, string> = {
  calculator: "Đang tính toán",
  get_current_time: "Đang lấy thời gian",
  fetch_url: "Đang lấy nội dung URL",
  gdrive_list_files: "Đang liệt kê Google Drive",
  gdrive_read_file: "Đang đọc tài liệu Google Drive",
  gdrive_search: "Đang tìm kiếm Google Drive",
  echo: "Đang xử lý",
};

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? `Đang dùng công cụ: ${name}`;
}

export function ChatArea({ conversationId, onConversationCreated }: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [streamingMessages, setStreamingMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolCall[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const createConversation = useCreateAnthropicConversation();

  const { data: savedMessages, isLoading: loadingMessages } = useListAnthropicMessages(
    conversationId ?? 0,
    { query: { enabled: !!conversationId, queryKey: getListAnthropicMessagesQueryKey(conversationId ?? 0) } }
  );

  useEffect(() => {
    setStreamingMessages([]);
    setActiveTools([]);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [savedMessages, streamingMessages, activeTools]);

  const sendMessage = async (convId: number, content: string) => {
    setLoading(true);
    setStreamingMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);
    setActiveTools([]);

    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const response = await fetch(`${BASE}/api/anthropic/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as {
              content?: string;
              tool_call?: { name: string; status: string };
              done?: boolean;
              error?: string;
            };

            if (event.content) {
              setStreamingMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) {
                  updated[updated.length - 1] = { ...last, content: last.content + event.content };
                }
                return updated;
              });
            }

            if (event.tool_call) {
              const { name, status } = event.tool_call;
              setActiveTools(prev => {
                const idx = prev.findIndex(t => t.name === name && t.status !== "done" && t.status !== "error");
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = { name, status: status as ToolCall["status"] };
                  return updated;
                }
                return [...prev, { name, status: status as ToolCall["status"] }];
              });
              if (status === "done" || status === "error") {
                setTimeout(() => {
                  setActiveTools(prev => prev.filter(t => !(t.name === name && (t.status === "done" || t.status === "error"))));
                }, 1500);
              }
            }

            if (event.done) {
              setStreamingMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) {
                  updated[updated.length - 1] = { ...last, isStreaming: false };
                }
                return updated;
              });
              await queryClient.invalidateQueries({ queryKey: getListAnthropicMessagesQueryKey(convId) });
              await queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
              setStreamingMessages([]);
              setActiveTools([]);
            }

            if (event.error) {
              setStreamingMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) {
                  updated[updated.length - 1] = { ...last, content: `Lỗi: ${event.error}`, isStreaming: false };
                }
                return updated;
              });
            }
          } catch {
            // skip unparseable SSE lines
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStreamingMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.isStreaming) {
          updated[updated.length - 1] = { ...last, content: `Lỗi kết nối: ${msg}`, isStreaming: false };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;
    setInput("");

    setStreamingMessages(prev => [...prev, { role: "user", content }]);

    let convId = conversationId;
    if (!convId) {
      const title = content.slice(0, 40) + (content.length > 40 ? "..." : "");
      const conv = await createConversation.mutateAsync({ data: { title } });
      convId = conv.id;
      await queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
      onConversationCreated(convId);
    }

    await sendMessage(convId, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const allMessages: LocalMessage[] = [
    ...((savedMessages ?? []).map(m => ({ role: m.role as "user" | "assistant", content: m.content }))),
    ...streamingMessages,
  ];

  const isEmpty = !conversationId && allMessages.length === 0;

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <h1 className="text-sm font-medium text-muted-foreground tracking-wide">Trợ lý AI SmartHomeQ</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary/60" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Bắt đầu trò chuyện</p>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Hỏi về sản phẩm nhà thông minh, tư vấn Zigbee / WiFi, giá cả, hoặc bất cứ điều gì.
                </p>
              </div>
            </div>
          )}

          {loadingMessages && conversationId && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingMessages && allMessages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}

              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm"
              }`}>
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="min-h-[1em]">
                    {msg.content ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse rounded-sm" />
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </div>
          ))}

          {activeTools.filter(t => t.status === "starting" || t.status === "running").map((tool, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground pl-10">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{toolLabel(tool.name)}...</span>
            </div>
          ))}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="px-4 pb-5 pt-3 border-t border-border shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end bg-secondary/40 border border-border rounded-2xl px-3 py-2 focus-within:border-primary/40 transition-colors">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhắn tin với trợ lý..."
              className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[40px] max-h-[200px] placeholder:text-muted-foreground/50 p-0 pt-1"
              rows={1}
            />
            <Button
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              size="icon"
              className="shrink-0 h-8 w-8 rounded-xl mb-0.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground/30 mt-2">
            Enter gửi tin — Shift+Enter xuống dòng
          </p>
        </div>
      </div>
    </div>
  );
}
