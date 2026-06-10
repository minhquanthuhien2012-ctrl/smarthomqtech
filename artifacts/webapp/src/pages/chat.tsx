import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Home } from "lucide-react";
import { apiBase, apiJson } from "@/lib/api";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
}

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function initConversation() {
    try {
      const conv = await apiJson<Conversation>("/api/anthropic/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "Chat SmartHomeQ" }),
      });
      setConversationId(conv.id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming || !conversationId) return;
    const text = input.trim();
    setInput("");
    setStreaming(true);

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch(
        `${apiBase()}/api/anthropic/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        }
      );

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
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
          const json = line.slice(6).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const evt = JSON.parse(json);
            if (evt.type === "text_delta" && evt.text) {
              setMessages((prev) => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  content: msgs[msgs.length - 1].content + evt.text,
                };
                return msgs;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: "Có lỗi xảy ra, vui lòng thử lại.",
        };
        return msgs;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, conversationId]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
          <Home className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">SmartHomeQ</div>
          <div className="text-xs text-muted-foreground">Tư vấn nhà thông minh</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-base">Xin chào! Tôi là trợ lý SmartHomeQ</p>
              <p className="text-sm text-muted-foreground mt-1">Hỏi tôi về sản phẩm nhà thông minh nhé!</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
              {["Thiết bị nhà thông minh phổ biến?", "Giá camera an ninh bao nhiêu?", "Cách lắp đặt khóa thông minh?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white text-xs ${msg.role === "user" ? "bg-primary" : "bg-slate-600"}`}>
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-tr-sm"
                  : "bg-card border rounded-tl-sm"
              }`}
            >
              {msg.content || (
                streaming && msg.role === "assistant" ? (
                  <span className="flex gap-1 items-center text-muted-foreground">
                    <span className="animate-bounce delay-0">●</span>
                    <span className="animate-bounce delay-100">●</span>
                    <span className="animate-bounce delay-200">●</span>
                  </span>
                ) : ""
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white px-3 py-3">
        <div className="flex items-end gap-2 rounded-2xl border bg-card px-3 py-2 shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-28"
            style={{ height: "24px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40 transition-opacity"
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-1.5">SmartHomeQ AI · smarthomeq.tech</p>
      </div>
    </div>
  );
}
