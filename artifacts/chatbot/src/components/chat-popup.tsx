import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAnthropicMessages,
  getListAnthropicMessagesQueryKey,
  useCreateAnthropicConversation,
  getListAnthropicConversationsQueryKey,
} from "@workspace/api-client-react";

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
  fetch_url: "Đang tra cứu sản phẩm...",
  calculator: "Đang tính toán...",
  get_current_time: "Đang lấy thời gian...",
  gdrive_list_files: "Đang đọc tài liệu...",
  gdrive_read_file: "Đang đọc tài liệu...",
  gdrive_search: "Đang tìm kiếm...",
};

export function ChatPopup() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streamingMessages, setStreamingMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolCall[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const createConversation = useCreateAnthropicConversation();

  const { data: savedMessages } = useListAnthropicMessages(
    conversationId ?? 0,
    { query: { enabled: !!conversationId, queryKey: getListAnthropicMessagesQueryKey(conversationId ?? 0) } }
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [savedMessages, streamingMessages, activeTools]);

  const allMessages: LocalMessage[] = [
    ...((savedMessages ?? []).map(m => ({ role: m.role as "user" | "assistant", content: m.content }))),
    ...streamingMessages,
  ];

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

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

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
              content?: string; tool_call?: { name: string; status: string };
              done?: boolean; error?: string;
            };

            if (event.content) {
              setStreamingMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) updated[updated.length - 1] = { ...last, content: last.content + event.content };
                return updated;
              });
            }

            if (event.tool_call) {
              const { name, status } = event.tool_call;
              setActiveTools(prev => {
                const idx = prev.findIndex(t => t.name === name && t.status !== "done" && t.status !== "error");
                if (idx >= 0) { const u = [...prev]; u[idx] = { name, status: status as ToolCall["status"] }; return u; }
                return [...prev, { name, status: status as ToolCall["status"] }];
              });
              if (status === "done" || status === "error") {
                setTimeout(() => { setActiveTools(prev => prev.filter(t => !(t.name === name && (t.status === "done" || t.status === "error")))); }, 1200);
              }
            }

            if (event.done) {
              setStreamingMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) updated[updated.length - 1] = { ...last, isStreaming: false };
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
                if (last?.isStreaming) updated[updated.length - 1] = { ...last, content: `Lỗi: ${event.error}`, isStreaming: false };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStreamingMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.isStreaming) updated[updated.length - 1] = { ...last, content: `Lỗi kết nối: ${msg}`, isStreaming: false };
        return updated;
      });
    } finally { setLoading(false); }
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
      setConversationId(convId);
      await queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
    }
    await sendMessage(convId, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center"
        aria-label="Mở chatbot"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-background" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-7rem)] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary/5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">SmartHomeQ AI</p>
              <p className="text-xs text-muted-foreground">Tư vấn nhà thông minh 24/7</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {allMessages.length === 0 && (
              <div className="text-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Bot className="h-6 w-6 text-primary/60" />
                </div>
                <p className="text-sm font-medium">Xin chào! Tôi là AI tư vấn của SmartHomeQ</p>
                <p className="text-xs text-muted-foreground px-4">Hỏi về công tắc thông minh, camera, khóa cửa, đèn... tôi sẽ tư vấn ngay!</p>
                <div className="flex flex-wrap gap-1.5 justify-center px-2">
                  {["Zigbee vs WiFi?", "Camera giá rẻ?", "Công tắc Aqara?"].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-xs bg-secondary hover:bg-secondary/80 rounded-full px-3 py-1.5 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${
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
                        <span className="inline-block w-1.5 h-3.5 bg-current animate-pulse rounded-sm" />
                      )}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {activeTools.filter(t => t.status === "starting" || t.status === "running").map((tool, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{TOOL_LABELS[tool.name] ?? "Đang xử lý..."}</span>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <div className="px-3 py-2.5 border-t shrink-0">
            <div className="flex gap-2 items-end bg-secondary/40 border border-border rounded-xl px-3 py-1.5 focus-within:border-primary/40 transition-colors">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi về sản phẩm nhà thông minh..."
                className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[36px] max-h-[120px] placeholder:text-muted-foreground/50 p-0 pt-0.5"
                rows={1}
              />
              <Button
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                size="icon"
                className="shrink-0 h-7 w-7 rounded-lg mb-0.5"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/40 mt-1.5">SmartHomeQ AI • ĐT/Zalo: 0909 167 046</p>
          </div>
        </div>
      )}
    </>
  );
}
