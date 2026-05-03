import { useState, useRef, useEffect } from "react";
import { Code2, X, Send, Loader2, Bot, User, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ToolCall {
  name: string;
  status: "starting" | "running" | "done" | "error";
}

const SYSTEM_NOTE = `Bạn là AI Agent developer của MCP Server SmartHomeQ. Bạn có thể:
- Đọc/sửa file code trong hệ thống
- Tạo chatbot, tool, skill mới
- Debug lỗi
- Hướng dẫn cấu hình
Trả lời ngắn gọn, chính xác bằng tiếng Việt.`;

export function AgentPopup() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolCall[]>([]);
  const [convId, setConvId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTools]);

  const sendMessage = async (content: string) => {
    setLoading(true);
    setMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);
    setActiveTools([]);

    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

      let cId = convId;
      if (!cId) {
        const cr = await fetch(`${BASE}/api/anthropic/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: content.slice(0, 40) }),
        });
        const c = await cr.json() as { id: number };
        cId = c.id;
        setConvId(cId);
      }

      const response = await fetch(`${BASE}/api/anthropic/conversations/${cId}/messages`, {
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
              content?: string;
              tool_call?: { name: string; status: string };
              done?: boolean;
              error?: string;
            };

            if (event.content) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) updated[updated.length - 1] = { ...last, content: last.content + event.content };
                return updated;
              });
            }

            if (event.tool_call) {
              const { name, status } = event.tool_call;
              setActiveTools(prev => {
                const idx = prev.findIndex(t => t.name === name && t.status !== "done");
                if (idx >= 0) { const u = [...prev]; u[idx] = { name, status: status as ToolCall["status"] }; return u; }
                return [...prev, { name, status: status as ToolCall["status"] }];
              });
              if (status === "done" || status === "error") {
                setTimeout(() => { setActiveTools(p => p.filter(t => !(t.name === name && (t.status === "done" || t.status === "error")))); }, 1000);
              }
            }

            if (event.done) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) updated[updated.length - 1] = { ...last, isStreaming: false };
                return updated;
              });
              setActiveTools([]);
            }

            if (event.error) {
              setMessages(prev => {
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
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.isStreaming) updated[updated.length - 1] = { ...last, content: `Lỗi: ${msg}`, isStreaming: false };
        return updated;
      });
    } finally { setLoading(false); }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content }]);
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  const popupClass = maximized
    ? "fixed inset-4 z-50"
    : "fixed top-16 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[500px]";

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="AI Agent Developer"
        className="fixed top-3 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold shadow-lg hover:bg-violet-700 active:scale-95 transition-all"
      >
        <Code2 className="h-3.5 w-3.5" />
        <span>AI Agent</span>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </button>

      {open && (
        <div className={`${popupClass} flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden`}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-violet-600/10 shrink-0">
            <Code2 className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="font-semibold text-sm text-violet-300 flex-1">AI Agent Developer</span>
            <span className="text-xs text-muted-foreground">MCP Server</span>
            <button onClick={() => setMaximized(m => !m)} className="text-muted-foreground hover:text-foreground ml-1">
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center space-y-3 py-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                  <Bot className="h-5 w-5 text-violet-400" />
                </div>
                <p className="text-sm text-muted-foreground">AI Agent sẵn sàng hỗ trợ</p>
                <div className="flex flex-wrap gap-1.5 justify-center px-2">
                  {["Tạo tool mới", "Sửa system prompt", "Xem file index.ts", "Thêm chatbot"].map(q => (
                    <button key={q} onClick={() => setInput(q)}
                      className="text-xs bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 rounded-full px-2.5 py-1 transition-colors border border-violet-500/20">
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/50 px-4">{SYSTEM_NOTE.split("\n")[0]}</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-violet-400" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-secondary text-foreground rounded-bl-sm"
                }`}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="min-h-[1em]">
                      {msg.content ? <MarkdownRenderer content={msg.content} /> : <span className="inline-block w-1.5 h-3.5 bg-violet-400 animate-pulse rounded-sm" />}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3 w-3 text-violet-400" />
                  </div>
                )}
              </div>
            ))}

            {activeTools.filter(t => t.status !== "done" && t.status !== "error").map((tool, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-violet-400 pl-8">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{tool.name}...</span>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <div className="px-3 py-2.5 border-t shrink-0">
            <div className="flex gap-2 items-end bg-secondary/40 border border-violet-500/20 rounded-xl px-3 py-1.5 focus-within:border-violet-500/40 transition-colors">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi về code, tạo tool, sửa chatbot..."
                className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[36px] max-h-[100px] placeholder:text-muted-foreground/40 p-0 pt-0.5"
                rows={1}
              />
              <Button
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                size="icon"
                className="shrink-0 h-7 w-7 rounded-lg mb-0.5 bg-violet-600 hover:bg-violet-700"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
