import { useState, useEffect, useRef } from "react";
import { Plus, Bot, Pencil, Trash2, Power, PowerOff, Copy, ExternalLink, Wrench, Zap, Link2, Wifi, WifiOff, RefreshCw, Send, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/api";
import { useWebhookBase } from "@/hooks/use-webhook-base";

interface Chatbot {
  id: number; name: string; description: string; systemPrompt: string;
  model: string; tools: string[]; skills: string[]; isActive: boolean; createdAt: string;
}
interface Tool { id: number; name: string; description: string; isBuiltin: boolean; }
interface Skill { id: number; name: string; description: string; }
interface Connection {
  id: number; name: string; type: string; config: Record<string, string>;
  status: string; lastConnectedAt: string | null; isActive: boolean;
}

const EMPTY_BOT: Partial<Chatbot> = { name: "", description: "", systemPrompt: "", model: "claude-sonnet-4-6", tools: [], skills: [], isActive: true };
const EMPTY_CONN: Partial<Connection> = { name: "", type: "zalo", config: {}, isActive: true };
const TYPE_LABELS: Record<string, string> = {
  zalo: "Zalo Bot", messenger: "Facebook Messenger",
  xiaozhi: "Xiaozhi (WebSocket)", webhook: "Webhook tùy chỉnh", websocket: "WebSocket tùy chỉnh",
};
const STATUS_COLOR: Record<string, string> = {
  connected: "bg-green-500", disconnected: "bg-gray-400", error: "bg-red-500", connecting: "bg-yellow-400",
};

interface ChatMsg { role: "user" | "assistant"; text: string; }

export default function ChatbotsPage() {
  const webhookBase = useWebhookBase();
  const { toast } = useToast();

  // Chatbots state
  const [bots, setBots] = useState<Chatbot[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [botLoading, setBotLoading] = useState(true);
  const [botOpen, setBotOpen] = useState(false);
  const [botForm, setBotForm] = useState<Partial<Chatbot>>(EMPTY_BOT);
  const [editingBot, setEditingBot] = useState<number | null>(null);
  const [botTab, setBotTab] = useState<"basic" | "tools" | "channel">("basic");

  // Connections state
  const [conns, setConns] = useState<Connection[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [connOpen, setConnOpen] = useState(false);
  const [connForm, setConnForm] = useState<Partial<Connection>>(EMPTY_CONN);
  const [connConfig, setConnConfig] = useState<Record<string, string>>({});
  const [editingConn, setEditingConn] = useState<number | null>(null);
  const [connecting, setConnecting] = useState<number | null>(null);

  // Test chat state
  const [testOpen, setTestOpen] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testHistory, setTestHistory] = useState<ChatMsg[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testConvId, setTestConvId] = useState<number | null>(null);
  const testEndRef = useRef<HTMLDivElement>(null);

  const loadBots = async () => {
    setBotLoading(true);
    try {
      const [botsRes, toolsRes, skillsRes] = await Promise.all([
        fetch(`${apiBase()}/admin/chatbots`).then(r => r.json()) as Promise<Chatbot[]>,
        fetch(`${apiBase()}/admin/tools`).then(r => r.json()) as Promise<Tool[]>,
        fetch(`${apiBase()}/admin/skills`).then(r => r.json()) as Promise<Skill[]>,
      ]);
      setBots(botsRes); setAllTools(toolsRes); setAllSkills(skillsRes);
    } catch { toast({ title: "Không thể tải chatbots", variant: "destructive" }); }
    finally { setBotLoading(false); }
  };

  const loadConns = async () => {
    setConnLoading(true);
    try {
      const r = await fetch(`${apiBase()}/admin/connections`);
      setConns(await r.json() as Connection[]);
    } catch { toast({ title: "Không thể tải kết nối", variant: "destructive" }); }
    finally { setConnLoading(false); }
  };

  useEffect(() => { void loadBots(); void loadConns(); }, []);
  useEffect(() => { testEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [testHistory]);

  // ── Chatbot CRUD ──
  const saveBot = async () => {
    try {
      const url = editingBot ? `${apiBase()}/admin/chatbots/${editingBot}` : `${apiBase()}/admin/chatbots`;
      const r = await fetch(url, { method: editingBot ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(botForm) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editingBot ? "Đã cập nhật" : "Đã tạo chatbot" });
      setBotOpen(false); setBotForm(EMPTY_BOT); setEditingBot(null); setBotTab("basic"); void loadBots();
    } catch { toast({ title: "Lỗi lưu chatbot", variant: "destructive" }); }
  };

  const delBot = async (id: number) => {
    if (!confirm("Xóa chatbot này?")) return;
    await fetch(`${apiBase()}/admin/chatbots/${id}`, { method: "DELETE" });
    toast({ title: "Đã xóa" }); void loadBots();
  };

  const toggleBot = async (bot: Chatbot) => {
    await fetch(`${apiBase()}/admin/chatbots/${bot.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !bot.isActive }) });
    void loadBots();
  };

  const openEditBot = (bot: Chatbot) => {
    setBotForm({ ...bot, tools: Array.isArray(bot.tools) ? bot.tools : [], skills: Array.isArray(bot.skills) ? bot.skills : [] });
    setEditingBot(bot.id); setBotOpen(true); setBotTab("basic");
  };

  const toggleTool = (name: string) => setBotForm(f => { const t = Array.isArray(f.tools) ? f.tools : []; return { ...f, tools: t.includes(name) ? t.filter(x => x !== name) : [...t, name] }; });
  const toggleSkill = (name: string) => setBotForm(f => { const s = Array.isArray(f.skills) ? f.skills : []; return { ...f, skills: s.includes(name) ? s.filter(x => x !== name) : [...s, name] }; });
  const copy = (text: string) => { void navigator.clipboard.writeText(text); toast({ title: "Đã sao chép!" }); };

  // ── Connection CRUD ──
  const saveConn = async () => {
    try {
      const url = editingConn ? `${apiBase()}/admin/connections/${editingConn}` : `${apiBase()}/admin/connections`;
      const r = await fetch(url, { method: editingConn ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...connForm, config: connConfig }) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editingConn ? "Đã cập nhật" : "Đã tạo kết nối" });
      setConnOpen(false); setEditingConn(null); setConnForm(EMPTY_CONN); setConnConfig({}); void loadConns();
    } catch { toast({ title: "Lỗi lưu kết nối", variant: "destructive" }); }
  };

  const delConn = async (id: number) => {
    if (!confirm("Xóa kết nối này?")) return;
    await fetch(`${apiBase()}/admin/connections/${id}`, { method: "DELETE" });
    toast({ title: "Đã xóa" }); void loadConns();
  };

  const connectConn = async (conn: Connection) => {
    setConnecting(conn.id);
    try {
      const r = await fetch(`${apiBase()}/admin/connections/${conn.id}/connect`, { method: "POST" });
      const data = await r.json() as { status: string; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Lỗi");
      toast({ title: `Kết nối thành công: ${conn.name}` }); void loadConns();
    } catch (err) {
      toast({ title: `Lỗi: ${err instanceof Error ? err.message : String(err)}`, variant: "destructive" });
      void loadConns();
    } finally { setConnecting(null); }
  };

  const disconnectConn = async (conn: Connection) => {
    await fetch(`${apiBase()}/admin/connections/${conn.id}/disconnect`, { method: "POST" });
    toast({ title: "Đã ngắt kết nối" }); void loadConns();
  };

  const openEditConn = (conn: Connection) => { setConnForm(conn); setConnConfig(conn.config ?? {}); setEditingConn(conn.id); setConnOpen(true); };

  // ── Test Chat ──
  const openTestChat = async () => {
    setTestHistory([]); setTestMsg(""); setTestConvId(null); setTestOpen(true);
    try {
      const r = await fetch(`${apiBase()}/anthropic/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Test chat" }) });
      const conv = await r.json() as { id: number };
      setTestConvId(conv.id);
    } catch { toast({ title: "Không thể tạo cuộc hội thoại test", variant: "destructive" }); }
  };

  const sendTestMsg = async () => {
    if (!testMsg.trim() || !testConvId || testLoading) return;
    const msg = testMsg.trim();
    setTestMsg("");
    setTestHistory(h => [...h, { role: "user", text: msg }]);
    setTestLoading(true);
    let reply = "";
    try {
      const r = await fetch(`${apiBase()}/anthropic/conversations/${testConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg }),
      });
      if (!r.body) throw new Error("No stream");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      setTestHistory(h => [...h, { role: "assistant", text: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
            if (data.content) {
              reply += data.content;
              setTestHistory(h => { const n = [...h]; n[n.length - 1] = { role: "assistant", text: reply }; return n; });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      toast({ title: `Lỗi: ${err instanceof Error ? err.message : String(err)}`, variant: "destructive" });
    } finally { setTestLoading(false); }
  };

  const selectedType = connForm.type ?? "zalo";

  return (
    <div className="space-y-8">
      {/* ── CHATBOTS SECTION ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Chatbots</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">Quản lý chatbot AI</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => void openTestChat()}>
              <MessageSquare className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Test Chat</span>
            </Button>
            <Button size="sm" onClick={() => { setBotForm(EMPTY_BOT); setEditingBot(null); setBotTab("basic"); setBotOpen(true); }}>
              <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Thêm chatbot</span>
            </Button>
          </div>
        </div>

        {botLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Đang tải...</div>
        ) : bots.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có chatbot nào.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {bots.map(bot => (
              <Card key={bot.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-semibold truncate text-sm">{bot.name}</span>
                  </div>
                  <Badge variant={bot.isActive ? "default" : "secondary"} className="shrink-0 text-xs">
                    {bot.isActive ? "Đang chạy" : "Tắt"}
                  </Badge>
                </div>
                {bot.description && <p className="text-xs text-muted-foreground line-clamp-2">{bot.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded font-mono">{bot.model.replace("claude-", "")}</span>
                  {Array.isArray(bot.tools) && bot.tools.length > 0 && <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">{bot.tools.length} tools</span>}
                  {Array.isArray(bot.skills) && bot.skills.length > 0 && <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">{bot.skills.length} skills</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEditBot(bot)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => void toggleBot(bot)}>
                    {bot.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => void delBot(bot.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── CONNECTIONS SECTION ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Kết nối</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">Zalo OA, Messenger, Xiaozhi WebSocket...</p>
          </div>
          <Button size="sm" onClick={() => { setConnForm(EMPTY_CONN); setEditingConn(null); setConnConfig({}); setConnOpen(true); }} className="shrink-0">
            <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Thêm kết nối</span>
          </Button>
        </div>

        {connLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Đang tải...</div>
        ) : conns.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có kết nối nào.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {conns.map(conn => (
              <Card key={conn.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${STATUS_COLOR[conn.status] ?? "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{conn.name}</span>
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[conn.type] ?? conn.type}</Badge>
                      <Badge variant={conn.status === "connected" ? "default" : "secondary"} className="text-[10px]">{conn.status}</Badge>
                    </div>
                    {conn.lastConnectedAt && <p className="text-xs text-muted-foreground mt-0.5">Lần cuối: {new Date(conn.lastConnectedAt).toLocaleString("vi-VN")}</p>}
                  </div>
                </div>
                {(conn.type === "zalo" || conn.type === "messenger") && conn.status === "connected" && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-blue-400">Webhook URL:</p>
                    <div className="flex items-start gap-2">
                      <code className="text-xs text-blue-300 flex-1 break-all leading-relaxed">{webhookBase}/api/webhooks/{conn.type}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copy(`${webhookBase}/api/webhooks/${conn.type}`)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {conn.status !== "connected" ? (
                    <Button size="sm" className="flex-1 h-8" onClick={() => void connectConn(conn)} disabled={connecting === conn.id}>
                      {connecting === conn.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Wifi className="h-3.5 w-3.5 mr-1.5" />}
                      Kết nối
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => void disconnectConn(conn)}>
                      <WifiOff className="h-3.5 w-3.5 mr-1.5" /> Ngắt
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEditConn(conn)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive" onClick={() => void delConn(conn.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── CHATBOT DIALOG ── */}
      <Dialog open={botOpen} onOpenChange={setBotOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingBot ? "Sửa chatbot" : "Thêm chatbot mới"}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1 border-b pb-2 overflow-x-auto">
            {(["basic", "tools", "channel"] as const).map(t => (
              <button key={t} onClick={() => setBotTab(t)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors whitespace-nowrap ${botTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                {t === "basic" ? "Cơ bản" : t === "tools" ? "Tools & Skills" : "Kênh kết nối"}
              </button>
            ))}
          </div>
          {botTab === "basic" && (
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Tên chatbot *</Label>
                <Input value={botForm.name ?? ""} onChange={e => setBotForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Tư vấn SmartHomeQ" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Mô tả</Label>
                <Input value={botForm.description ?? ""} onChange={e => setBotForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Model AI</Label>
                <Select value={botForm.model ?? "claude-sonnet-4-6"} onValueChange={v => setBotForm(f => ({ ...f, model: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-6">Claude Sonnet (Khuyên dùng)</SelectItem>
                    <SelectItem value="claude-opus-4-5">Claude Opus (Mạnh nhất)</SelectItem>
                    <SelectItem value="claude-haiku-3-5">Claude Haiku (Nhanh nhất)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">System Prompt</Label>
                <Textarea value={botForm.systemPrompt ?? ""} onChange={e => setBotForm(f => ({ ...f, systemPrompt: e.target.value }))} rows={5} placeholder="Hướng dẫn hành vi cho chatbot..." className="text-sm" />
              </div>
            </div>
          )}
          {botTab === "tools" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /><Label className="text-sm">Chọn Tools ({(botForm.tools ?? []).length} đã chọn)</Label></div>
                {allTools.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có tool nào.</p> : (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                    {allTools.map(tool => {
                      const sel = (botForm.tools ?? []).includes(tool.name);
                      return (
                        <button key={tool.id} onClick={() => toggleTool(tool.name)}
                          className={`text-left p-3 rounded-lg border transition-all ${sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sel ? "bg-primary border-primary" : "border-border"}`}>
                              {sel && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                            </div>
                            <span className="font-mono text-xs font-semibold">{tool.name}</span>
                            {tool.isBuiltin && <Badge variant="outline" className="text-[10px] px-1 ml-auto">Builtin</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1">{tool.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /><Label className="text-sm">Chọn Skills ({(botForm.skills ?? []).length} đã chọn)</Label></div>
                {allSkills.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có skill nào.</p> : (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                    {allSkills.map(skill => {
                      const sel = (botForm.skills ?? []).includes(skill.name);
                      return (
                        <button key={skill.id} onClick={() => toggleSkill(skill.name)}
                          className={`text-left p-3 rounded-lg border transition-all ${sel ? "border-yellow-500 bg-yellow-500/5" : "border-border hover:border-yellow-500/40"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sel ? "bg-yellow-500 border-yellow-500" : "border-border"}`}>
                              {sel && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                            <span className="text-sm font-semibold">{skill.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1">{skill.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {botTab === "channel" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Webhook URL để kết nối với các nền tảng bên ngoài.</p>
              {[
                { key: "zalo", label: "Zalo Bot", emoji: "🟦", path: "/api/webhooks/zalo", link: "https://chatbot.zalo.me" },
                { key: "messenger", label: "Facebook Messenger", emoji: "💬", path: "/api/webhooks/messenger", link: "https://developers.facebook.com/apps" },
              ].map(ch => (
                <div key={ch.key} className="border rounded-xl p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ch.emoji}</span>
                    <p className="font-semibold text-sm">{ch.label}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Webhook URL:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-blue-400 flex-1 break-all">{webhookBase}{ch.path}</code>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copy(`${webhookBase}${ch.path}`)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <a href={ch.link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Mở dashboard
                  </a>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 flex-row">
            <Button variant="outline" onClick={() => setBotOpen(false)} className="flex-1 sm:flex-none">Hủy</Button>
            <Button onClick={() => void saveBot()} disabled={!botForm.name} className="flex-1 sm:flex-none">Lưu chatbot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CONNECTION DIALOG ── */}
      <Dialog open={connOpen} onOpenChange={setConnOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingConn ? "Sửa kết nối" : "Thêm kết nối mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Tên *</Label>
              <Input value={connForm.name ?? ""} onChange={e => setConnForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Zalo SmartHomeQ" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Loại</Label>
              <Select value={selectedType} onValueChange={v => { setConnForm(f => ({ ...f, type: v })); setConnConfig({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedType === "zalo" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Bot Access Token</Label>
                  <Input value={connConfig.accessToken ?? ""} onChange={e => setConnConfig(s => ({ ...s, accessToken: e.target.value }))} placeholder="OA_ID:token" className="font-mono text-xs" />
                  <p className="text-[11px] text-muted-foreground">Lấy tại chatbot.zalo.me → Cài đặt → Access Token</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">OA Access Token <span className="text-yellow-400">⚡ Bắt buộc để gửi tin</span></Label>
                  <Input value={connConfig.oaAccessToken ?? ""} onChange={e => setConnConfig(s => ({ ...s, oaAccessToken: e.target.value }))} placeholder="Lấy tại oa.zalo.me/manage" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Secret Token</Label>
                  <Input value={connConfig.secretToken ?? ""} onChange={e => setConnConfig(s => ({ ...s, secretToken: e.target.value }))} placeholder="Secret token xác thực webhook" className="font-mono text-xs" />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-400">Webhook URL — dán vào Zalo Bot dashboard:</p>
                  <div className="flex items-start gap-2">
                    <code className="text-xs text-blue-300 flex-1 break-all font-mono">{webhookBase}/api/webhooks/zalo</code>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copy(`${webhookBase}/api/webhooks/zalo`)}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex gap-3">
                    <a href="https://chatbot.zalo.me" target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline"><ExternalLink className="h-3 w-3" /> Zalo Bot</a>
                    <a href="https://oa.zalo.me/manage" target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline"><ExternalLink className="h-3 w-3" /> Zalo OA</a>
                  </div>
                </div>
              </div>
            )}
            {selectedType === "messenger" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Page Access Token</Label>
                  <Input value={connConfig.pageToken ?? ""} onChange={e => setConnConfig(s => ({ ...s, pageToken: e.target.value }))} placeholder="EAA..." className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Verify Token</Label>
                  <Input value={connConfig.verifyToken ?? ""} onChange={e => setConnConfig(s => ({ ...s, verifyToken: e.target.value }))} placeholder="Token xác thực" className="font-mono text-xs" />
                </div>
              </div>
            )}
            {selectedType === "xiaozhi" && (
              <div className="space-y-1.5">
                <Label className="text-sm">WebSocket URL</Label>
                <Input value={connConfig.wsUrl ?? ""} onChange={e => setConnConfig(s => ({ ...s, wsUrl: e.target.value }))} placeholder="wss://api.xiaozhi.me/mcp/?token=..." className="font-mono text-xs" />
              </div>
            )}
            {(selectedType === "webhook" || selectedType === "websocket") && (
              <div className="space-y-1.5">
                <Label className="text-sm">URL</Label>
                <Input value={connConfig.url ?? ""} onChange={e => setConnConfig(s => ({ ...s, url: e.target.value }))} placeholder="https:// hoặc wss://" className="font-mono text-xs" />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-row">
            <Button variant="outline" onClick={() => setConnOpen(false)} className="flex-1 sm:flex-none">Hủy</Button>
            <Button onClick={() => void saveConn()} disabled={!connForm.name} className="flex-1 sm:flex-none">Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TEST CHAT DIALOG ── */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg h-[80dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Test Chat AI
              </DialogTitle>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setTestOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Gửi tin thử để kiểm tra AI phản hồi đúng chưa</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {testHistory.length === 0 && !testLoading && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Gõ tin nhắn để test chatbot</p>
              </div>
            )}
            {testHistory.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{m.text || "▌"}</pre>
                </div>
              </div>
            ))}
            <div ref={testEndRef} />
          </div>
          <div className="border-t px-3 py-3 shrink-0">
            <div className="flex gap-2">
              <Input
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendTestMsg(); } }}
                placeholder="Nhập tin nhắn test..."
                disabled={!testConvId || testLoading}
                className="flex-1 text-sm"
              />
              <Button size="sm" onClick={() => void sendTestMsg()} disabled={!testMsg.trim() || !testConvId || testLoading} className="shrink-0">
                {testLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
