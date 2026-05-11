import { useState, useEffect } from "react";
import { Plus, Bot, Pencil, Trash2, Power, PowerOff, Copy, ExternalLink, Wrench, Zap } from "lucide-react";
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

const EMPTY: Partial<Chatbot> = { name: "", description: "", systemPrompt: "", model: "claude-sonnet-4-6", tools: [], skills: [], isActive: true };

export default function ChatbotsPage() {
  const webhookBase = useWebhookBase();
  const [items, setItems] = useState<Chatbot[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Chatbot>>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [tab, setTab] = useState<"basic" | "tools" | "channel">("basic");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [bots, tools, skills] = await Promise.all([
        fetch(`${apiBase()}/admin/chatbots`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<Chatbot[]>; }),
        fetch(`${apiBase()}/admin/tools`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<Tool[]>; }),
        fetch(`${apiBase()}/admin/skills`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<Skill[]>; }),
      ]);
      setItems(bots); setAllTools(tools); setAllSkills(skills);
    } catch (err) {
      console.error("[chatbots] load failed:", err);
      toast({ title: "Không thể tải dữ liệu — kiểm tra server", variant: "destructive" });
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    try {
      const url = editing ? `${apiBase()}/admin/chatbots/${editing}` : `${apiBase()}/admin/chatbots`;
      const r = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editing ? "Đã cập nhật" : "Đã tạo chatbot" });
      setOpen(false); setForm(EMPTY); setEditing(null); setTab("basic"); void load();
    } catch { toast({ title: "Lỗi", variant: "destructive" }); }
  };

  const del = async (id: number) => {
    if (!confirm("Xóa chatbot này?")) return;
    await fetch(`${apiBase()}/admin/chatbots/${id}`, { method: "DELETE" });
    toast({ title: "Đã xóa" }); void load();
  };

  const toggle = async (bot: Chatbot) => {
    await fetch(`${apiBase()}/admin/chatbots/${bot.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !bot.isActive }) });
    void load();
  };

  const openEdit = (bot: Chatbot) => {
    setForm({ ...bot, tools: Array.isArray(bot.tools) ? bot.tools : [], skills: Array.isArray(bot.skills) ? bot.skills : [] });
    setEditing(bot.id); setOpen(true); setTab("basic");
  };

  const toggleTool = (name: string) => setForm(f => { const t = Array.isArray(f.tools) ? f.tools : []; return { ...f, tools: t.includes(name) ? t.filter(x => x !== name) : [...t, name] }; });
  const toggleSkill = (name: string) => setForm(f => { const s = Array.isArray(f.skills) ? f.skills : []; return { ...f, skills: s.includes(name) ? s.filter(x => x !== name) : [...s, name] }; });
  const copy = (text: string) => { void navigator.clipboard.writeText(text); toast({ title: "Đã sao chép!" }); };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Chatbots</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Quản lý các chatbot AI và kênh kết nối</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setTab("basic"); setOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Thêm chatbot</span>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Đang tải...</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Chưa có chatbot nào.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(bot => (
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
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEdit(bot)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => void toggle(bot)}>
                  {bot.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => void del(bot.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editing ? "Sửa chatbot" : "Thêm chatbot mới"}</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b pb-2 overflow-x-auto">
            {(["basic", "tools", "channel"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors whitespace-nowrap ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                {t === "basic" ? "Cơ bản" : t === "tools" ? "Tools & Skills" : "Kênh kết nối"}
              </button>
            ))}
          </div>

          {tab === "basic" && (
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Tên chatbot *</Label>
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Tư vấn SmartHomeQ" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Mô tả</Label>
                <Input value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Model AI</Label>
                <Select value={form.model ?? "claude-sonnet-4-6"} onValueChange={v => setForm(f => ({ ...f, model: v }))}>
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
                <Textarea value={form.systemPrompt ?? ""} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))} rows={5} placeholder="Hướng dẫn hành vi cho chatbot..." className="text-sm" />
              </div>
            </div>
          )}

          {tab === "tools" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Chọn Tools ({(form.tools ?? []).length} đã chọn)</Label>
                </div>
                {allTools.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có tool nào.</p> : (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                    {allTools.map(tool => {
                      const sel = (form.tools ?? []).includes(tool.name);
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
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <Label className="text-sm">Chọn Skills ({(form.skills ?? []).length} đã chọn)</Label>
                </div>
                {allSkills.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có skill nào.</p> : (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                    {allSkills.map(skill => {
                      const sel = (form.skills ?? []).includes(skill.name);
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

          {tab === "channel" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Webhook URL để kết nối với các nền tảng bên ngoài.</p>
              {[
                { key: "zalo", label: "Zalo OA", emoji: "🟦", path: "/api/webhooks/zalo", link: "https://developers.zalo.me/app", linkLabel: "Zalo Developer Console" },
                { key: "messenger", label: "Facebook Messenger", emoji: "💬", path: "/api/webhooks/messenger", link: "https://developers.facebook.com/apps", linkLabel: "Meta Developer Console" },
              ].map(ch => (
                <div key={ch.key} className="border rounded-xl p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <span className="text-lg">{ch.emoji}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{ch.label}</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Webhook URL:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-blue-400 flex-1 break-all leading-relaxed">{webhookBase}{ch.path}</code>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copy(`${webhookBase}${ch.path}`)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <a href={ch.link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> {ch.linkLabel}
                  </a>
                </div>
              ))}
              <div className="border rounded-xl p-3 sm:p-4 opacity-60">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div>
                    <p className="font-semibold text-sm">Xiaozhi (WebSocket)</p>
                    <p className="text-xs text-muted-foreground">Quản lý trong mục Kết nối</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">Hủy</Button>
            <Button onClick={() => void save()} disabled={!form.name} className="flex-1 sm:flex-none">Lưu chatbot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
