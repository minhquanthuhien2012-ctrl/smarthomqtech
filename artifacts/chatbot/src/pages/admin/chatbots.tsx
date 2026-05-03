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

interface Chatbot {
  id: number;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  skills: string[];
  isActive: boolean;
  createdAt: string;
}

interface Tool { id: number; name: string; description: string; isBuiltin: boolean; }
interface Skill { id: number; name: string; description: string; }

const EMPTY: Partial<Chatbot> = {
  name: "", description: "", systemPrompt: "", model: "claude-sonnet-4-6",
  tools: [], skills: [], isActive: true,
};

const WEBHOOK_BASE = typeof window !== "undefined" ? window.location.origin : "";

export default function ChatbotsPage() {
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
        fetch(`${apiBase()}/admin/chatbots`).then(r => r.json()) as Promise<Chatbot[]>,
        fetch(`${apiBase()}/admin/tools`).then(r => r.json()) as Promise<Tool[]>,
        fetch(`${apiBase()}/admin/skills`).then(r => r.json()) as Promise<Skill[]>,
      ]);
      setItems(bots);
      setAllTools(tools);
      setAllSkills(skills);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    try {
      const url = editing ? `${apiBase()}/admin/chatbots/${editing}` : `${apiBase()}/admin/chatbots`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editing ? "Đã cập nhật" : "Đã tạo chatbot" });
      setOpen(false); setForm(EMPTY); setEditing(null); setTab("basic");
      void load();
    } catch { toast({ title: "Lỗi", variant: "destructive" }); }
  };

  const del = async (id: number) => {
    if (!confirm("Xóa chatbot này?")) return;
    await fetch(`${apiBase()}/admin/chatbots/${id}`, { method: "DELETE" });
    toast({ title: "Đã xóa" });
    void load();
  };

  const toggle = async (bot: Chatbot) => {
    await fetch(`${apiBase()}/admin/chatbots/${bot.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !bot.isActive }),
    });
    void load();
  };

  const openEdit = (bot: Chatbot) => {
    setForm({ ...bot, tools: Array.isArray(bot.tools) ? bot.tools : [], skills: Array.isArray(bot.skills) ? bot.skills : [] });
    setEditing(bot.id); setOpen(true); setTab("basic");
  };

  const toggleTool = (name: string) => {
    setForm(f => {
      const tools = Array.isArray(f.tools) ? f.tools : [];
      return { ...f, tools: tools.includes(name) ? tools.filter(t => t !== name) : [...tools, name] };
    });
  };

  const toggleSkill = (name: string) => {
    setForm(f => {
      const skills = Array.isArray(f.skills) ? f.skills : [];
      return { ...f, skills: skills.includes(name) ? skills.filter(s => s !== name) : [...skills, name] };
    });
  };

  const copy = (text: string) => { void navigator.clipboard.writeText(text); toast({ title: "Đã sao chép!" }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chatbots</h2>
          <p className="text-muted-foreground text-sm">Quản lý các chatbot AI và kênh kết nối</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditing(null); setTab("basic"); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Thêm chatbot
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có chatbot nào.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(bot => (
            <Card key={bot.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot className="h-5 w-5 shrink-0 text-primary" />
                  <span className="font-semibold truncate">{bot.name}</span>
                </div>
                <Badge variant={bot.isActive ? "default" : "secondary"} className="shrink-0 text-xs">
                  {bot.isActive ? "Đang chạy" : "Tắt"}
                </Badge>
              </div>
              {bot.description && <p className="text-sm text-muted-foreground line-clamp-2">{bot.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs bg-secondary px-2 py-0.5 rounded font-mono">{bot.model.replace("claude-", "")}</span>
                {Array.isArray(bot.tools) && bot.tools.length > 0 && (
                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">{bot.tools.length} tools</span>
                )}
                {Array.isArray(bot.skills) && bot.skills.length > 0 && (
                  <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">{bot.skills.length} skills</span>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(bot)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => void toggle(bot)}>
                  {bot.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => void del(bot.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa chatbot" : "Thêm chatbot mới"}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 border-b pb-2">
            {(["basic", "tools", "channel"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                {t === "basic" ? "Cơ bản" : t === "tools" ? "Tools & Skills" : "Kênh kết nối"}
              </button>
            ))}
          </div>

          {tab === "basic" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tên chatbot *</Label>
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Tư vấn SmartHomeQ" />
              </div>
              <div className="space-y-1.5">
                <Label>Mô tả</Label>
                <Input value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn" />
              </div>
              <div className="space-y-1.5">
                <Label>Model AI</Label>
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
                <Label>System Prompt</Label>
                <Textarea value={form.systemPrompt ?? ""} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))} rows={6} placeholder="Hướng dẫn hành vi cho chatbot..." />
              </div>
            </div>
          )}

          {tab === "tools" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <Label>Chọn Tools ({(form.tools ?? []).length} đã chọn)</Label>
                </div>
                {allTools.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có tool nào. Tạo tool trong mục Tools.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allTools.map(tool => {
                      const selected = (form.tools ?? []).includes(tool.name);
                      return (
                        <button key={tool.id} onClick={() => toggleTool(tool.name)}
                          className={`text-left p-3 rounded-lg border transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-border"}`}>
                              {selected && <span className="text-primary-foreground text-xs">✓</span>}
                            </div>
                            <span className="font-mono text-xs font-semibold">{tool.name}</span>
                            {tool.isBuiltin && <Badge variant="outline" className="text-[10px] px-1">Builtin</Badge>}
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
                  <Label>Chọn Skills ({(form.skills ?? []).length} đã chọn)</Label>
                </div>
                {allSkills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có skill nào. Tạo skill trong mục Skills.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allSkills.map(skill => {
                      const selected = (form.skills ?? []).includes(skill.name);
                      return (
                        <button key={skill.id} onClick={() => toggleSkill(skill.name)}
                          className={`text-left p-3 rounded-lg border transition-all ${selected ? "border-yellow-500 bg-yellow-500/5" : "border-border hover:border-yellow-500/40"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? "bg-yellow-500 border-yellow-500" : "border-border"}`}>
                              {selected && <span className="text-white text-xs">✓</span>}
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
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Webhook URL để kết nối chatbot này với các nền tảng bên ngoài.</p>

              <div className="space-y-3">
                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <span className="text-base">🟦</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Zalo OA</p>
                      <p className="text-xs text-muted-foreground">Webhook nhận tin nhắn từ Zalo OA</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Webhook URL — dán vào Zalo OA Dashboard:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-blue-400 flex-1 break-all">{WEBHOOK_BASE}/api/webhooks/zalo</code>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copy(`${WEBHOOK_BASE}/api/webhooks/zalo`)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <a href="https://developers.zalo.me/app" target="_blank" rel="noreferrer"
                    className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Mở Zalo OA Developer Console
                  </a>
                </div>

                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                      <span className="text-base">💬</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Facebook Messenger</p>
                      <p className="text-xs text-muted-foreground">Webhook nhận tin nhắn từ Messenger</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Webhook URL — dán vào Meta Developer:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-blue-400 flex-1 break-all">{WEBHOOK_BASE}/api/webhooks/messenger</code>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copy(`${WEBHOOK_BASE}/api/webhooks/messenger`)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer"
                    className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Mở Meta Developer Console
                  </a>
                </div>

                <div className="border rounded-xl p-4 space-y-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <span className="text-base">🤖</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Xiaozhi (WebSocket)</p>
                      <p className="text-xs text-muted-foreground">Kết nối qua trang Kết nối</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Xiaozhi dùng WebSocket, quản lý trong mục <strong>Kết nối</strong>.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={() => void save()} disabled={!form.name}>Lưu chatbot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
