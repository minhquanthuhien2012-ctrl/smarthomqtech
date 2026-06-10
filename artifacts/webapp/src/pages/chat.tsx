import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string) {
  return `${BASE}${path}`;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [botName, setBotName] = useState("AI cá nhân");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ai_business_name");
    if (saved) setBotName(saved);
    initConversation();
  }, []);

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem("ai_business_name");
      setBotName(saved || "AI cá nhân");
    };
    window.addEventListener("ai_name_updated", handler);
    return () => window.removeEventListener("ai_name_updated", handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function initConversation() {
    try {
      const res = await fetch(apiUrl("/api/anthropic/conversations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Chat AI cá nhân" }),
      });
      const conv = await res.json();
      setConversationId(conv.id);
    } catch {}
    setLoading(false);
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming || !conversationId) return;
    const text = input.trim();
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
    setStreaming(true);

    const uid = Date.now();
    setMessages(prev => [...prev,
      { id: uid, role: "user", content: text },
      { id: uid + 1, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch(
        apiUrl(`/api/anthropic/conversations/${conversationId}/messages`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        }
      );
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const evt = JSON.parse(json);
            if (evt.type === "text_delta" && evt.text) {
              setMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + evt.text };
                return msgs;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "Có lỗi xảy ra, vui lòng thử lại." };
        return msgs;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, conversationId]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  const suggestions = ["Sản phẩm nổi bật?", "Tư vấn nhà thông minh", "Liên hệ mua hàng"];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shrink-0">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-tight truncate">{botName}</div>
          <div className="text-xs text-muted-foreground">Trợ lý AI thông minh</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-base">{botName}</p>
              <p className="text-sm text-muted-foreground mt-1">Tôi có thể giúp gì cho bạn?</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {suggestions.map(q => (
                <button key={q} onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${msg.role === "user" ? "bg-primary" : "bg-slate-600"}`}>
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-card border rounded-tl-sm"
            }`}>
              {msg.content || (streaming && msg.role === "assistant"
                ? <span className="flex gap-1 items-center text-muted-foreground">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce [animation-delay:0.15s]">●</span>
                    <span className="animate-bounce [animation-delay:0.3s]">●</span>
                  </span>
                : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-white px-3 py-3 shrink-0">
        <div className="flex items-end gap-2 rounded-2xl border bg-card px-3 py-2 shadow-sm">
          <textarea ref={textareaRef} value={input}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKey}
            placeholder="Nhập câu hỏi..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            style={{ height: "24px", maxHeight: "120px" }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || streaming}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40 transition-opacity">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-1.5">smarthomeq.tech</p>
      </div>
    </div>
  );
}
