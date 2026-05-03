import { useState } from "react";
import { Plus, Bot, Pencil, Trash2, Power, PowerOff } from "lucide-react";
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

const EMPTY: Partial<Chatbot> = {
  name: "", description: "", systemPrompt: "", model: "claude-sonnet-4-6",
  tools: [], skills: [], isActive: true,
};

export default function ChatbotsPage() {
  const [items, setItems] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Chatbot>>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase()}/admin/chatbots`);
      setItems(await r.json() as Chatbot[]);
    } finally { setLoading(false); }
  };

  useState(() => { void load(); });

  const save = async () => {
    try {
      const url = editing ? `${apiBase()}/admin/chatbots/${editing}` : `${apiBase()}/admin/chatbots`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editing ? "Đã cập nhật" : "Đã tạo chatbot" });
      setOpen(false);
      setForm(EMPTY);
      setEditing(null);
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
    setForm(bot); setEditing(bot.id); setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chatbots</h2>
          <p className="text-muted-foreground text-sm">Quản lý các chatbot AI</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Thêm chatbot
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có chatbot nào. Bấm "Thêm chatbot" để bắt đầu.</p>
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
                <Badge variant={bot.isActive ? "default" : "secondary"} className="shrink-0">
                  {bot.isActive ? "Đang chạy" : "Tắt"}
                </Badge>
              </div>
              {bot.description && <p className="text-sm text-muted-foreground line-clamp-2">{bot.description}</p>}
              <div className="text-xs text-muted-foreground">Model: {bot.model}</div>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa chatbot" : "Thêm chatbot mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tên chatbot *</Label>
              <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Tư vấn SmartHomeQ" />
            </div>
            <div className="space-y-1.5">
              <Label>Mô tả</Label>
              <Input value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn về chatbot" />
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
              <Textarea
                value={form.systemPrompt ?? ""}
                onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                placeholder="Hướng dẫn hành vi cho chatbot..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={() => void save()} disabled={!form.name}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
