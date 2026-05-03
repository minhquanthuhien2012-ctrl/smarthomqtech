import { useState, useEffect } from "react";
import { Plus, Zap, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/api";

interface SkillAction { type: string; config: Record<string, string>; }
interface Skill {
  id: number; name: string; description: string; trigger: string;
  actions: SkillAction[]; isActive: boolean; createdAt: string;
}

const EMPTY: Partial<Skill> = { name: "", description: "", trigger: "", actions: [], isActive: true };
const ACTION_TYPES = [
  { value: "fetch_url", label: "Lấy nội dung URL" },
  { value: "send_message", label: "Gửi tin nhắn" },
  { value: "call_api", label: "Gọi API ngoài" },
  { value: "set_variable", label: "Đặt biến" },
  { value: "condition", label: "Điều kiện (if/else)" },
];

export default function SkillsPage() {
  const [items, setItems] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Skill>>(EMPTY);
  const [actions, setActions] = useState<SkillAction[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setItems(await fetch(`${apiBase()}/admin/skills`).then(r => r.json()) as Skill[]); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    try {
      const url = editing ? `${apiBase()}/admin/skills/${editing}` : `${apiBase()}/admin/skills`;
      const r = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, actions }) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editing ? "Đã cập nhật skill" : "Đã tạo skill" });
      setOpen(false); setEditing(null); setForm(EMPTY); setActions([]); void load();
    } catch { toast({ title: "Lỗi", variant: "destructive" }); }
  };

  const del = async (id: number) => {
    if (!confirm("Xóa skill này?")) return;
    await fetch(`${apiBase()}/admin/skills/${id}`, { method: "DELETE" });
    toast({ title: "Đã xóa" }); void load();
  };

  const toggle = async (skill: Skill) => {
    await fetch(`${apiBase()}/admin/skills/${skill.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !skill.isActive }) });
    void load();
  };

  const openEdit = (skill: Skill) => { setForm(skill); setActions(Array.isArray(skill.actions) ? skill.actions : []); setEditing(skill.id); setOpen(true); };
  const addAction = () => setActions(a => [...a, { type: "fetch_url", config: { url: "" } }]);
  const removeAction = (i: number) => setActions(a => a.filter((_, idx) => idx !== i));
  const updateAction = (i: number, field: keyof SkillAction, value: string) =>
    setActions(a => a.map((act, idx) => idx === i ? (field === "type" ? { type: value, config: {} } : { ...act, config: { ...act.config, [field]: value } }) : act));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Skills</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Tự động hóa hành vi chatbot</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setActions([]); setOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Thêm skill</span>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Đang tải...</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">Chưa có skill nào</p>
          <p className="text-xs max-w-xs mx-auto">Tạo skill để tự động hóa — ví dụ: khi khách hỏi về giá → tự động lấy giá từ website.</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map(skill => (
            <Card key={skill.id} className="overflow-hidden">
              <div className="p-3 sm:p-4 flex items-center gap-3">
                <button onClick={() => setExpanded(expanded === skill.id ? null : skill.id)} className="shrink-0 p-1 rounded hover:bg-muted">
                  {expanded === skill.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{skill.name}</span>
                    <Badge variant={skill.isActive ? "default" : "secondary"} className="text-[10px]">
                      {skill.isActive ? "Đang chạy" : "Tắt"}
                    </Badge>
                  </div>
                  {skill.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => void toggle(skill)}>
                    {skill.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEdit(skill)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive" onClick={() => void del(skill.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {expanded === skill.id && (
                <div className="px-3 sm:px-4 pb-4 border-t bg-muted/20 space-y-2.5 pt-3">
                  <div className="text-xs">
                    <span className="font-medium text-muted-foreground">Trigger: </span>
                    <code className="bg-secondary px-2 py-0.5 rounded">{skill.trigger || "(chưa đặt)"}</code>
                  </div>
                  {Array.isArray(skill.actions) && skill.actions.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Actions:</span>
                      {skill.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-background rounded-lg px-3 py-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
                          <span className="font-mono">{action.type}</span>
                          {action.config.url && <span className="text-muted-foreground truncate">→ {action.config.url}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editing ? "Sửa skill" : "Thêm skill mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Tên skill *</Label>
              <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Tự động lấy giá sản phẩm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Mô tả</Label>
              <Input value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Skill này làm gì" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Trigger</Label>
              <Input value={form.trigger ?? ""} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))} placeholder="VD: hỏi về giá, xem sản phẩm..." className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Khi chatbot nhận tin khớp trigger, skill sẽ tự động kích hoạt.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Actions ({actions.length})</Label>
                <Button size="sm" variant="outline" className="h-7" onClick={addAction}><Plus className="h-3.5 w-3.5 mr-1" /> Thêm</Button>
              </div>
              {actions.map((action, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Bước {i + 1}</span>
                    <select value={action.type} onChange={e => updateAction(i, "type", e.target.value)}
                      className="flex-1 text-xs sm:text-sm border rounded-lg px-2 py-1.5 bg-background">
                      {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive shrink-0" onClick={() => removeAction(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {action.type === "fetch_url" && <Input value={action.config.url ?? ""} onChange={e => updateAction(i, "url" as keyof SkillAction, e.target.value)} placeholder="https://..." className="text-sm" />}
                  {action.type === "send_message" && <Textarea value={action.config.message ?? ""} onChange={e => updateAction(i, "message" as keyof SkillAction, e.target.value)} placeholder="Nội dung tin nhắn..." rows={2} className="text-sm" />}
                  {action.type === "call_api" && <Input value={action.config.endpoint ?? ""} onChange={e => updateAction(i, "endpoint" as keyof SkillAction, e.target.value)} placeholder="https://api.example.com/endpoint" className="text-sm" />}
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">Hủy</Button>
            <Button onClick={() => void save()} disabled={!form.name} className="flex-1 sm:flex-none">Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
