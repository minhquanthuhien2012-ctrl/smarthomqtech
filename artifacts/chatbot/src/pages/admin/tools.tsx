import { useState, useEffect } from "react";
import { Plus, Wrench, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/api";

interface Tool {
  id: number; name: string; description: string;
  inputSchema: Record<string, unknown>; implementation: string;
  isBuiltin: boolean; isActive: boolean; createdAt: string;
}

const EMPTY: Partial<Tool> = { name: "", description: "", inputSchema: {}, implementation: "", isBuiltin: false, isActive: true };
const DEFAULT_SCHEMA = `{\n  "type": "object",\n  "properties": {\n    "input": { "type": "string", "description": "Tham số đầu vào" }\n  },\n  "required": ["input"]\n}`;

export default function ToolsPage() {
  const [items, setItems] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Tool>>(EMPTY);
  const [schemaStr, setSchemaStr] = useState(DEFAULT_SCHEMA);
  const [editing, setEditing] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase()}/admin/tools`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setItems(await r.json() as Tool[]);
    } catch (err) {
      console.error("[tools] load failed:", err);
      toast({ title: "Không thể tải tools — kiểm tra server", variant: "destructive" });
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    let schema: Record<string, unknown> = {};
    try { schema = JSON.parse(schemaStr) as Record<string, unknown>; }
    catch { toast({ title: "JSON Schema không hợp lệ", variant: "destructive" }); return; }
    try {
      const url = editing ? `${apiBase()}/admin/tools/${editing}` : `${apiBase()}/admin/tools`;
      const r = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, inputSchema: schema }) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editing ? "Đã cập nhật tool" : "Đã tạo tool" });
      setOpen(false); setEditing(null); setForm(EMPTY); setSchemaStr(DEFAULT_SCHEMA); void load();
    } catch { toast({ title: "Lỗi", variant: "destructive" }); }
  };

  const del = async (id: number) => {
    if (!confirm("Xóa tool này?")) return;
    await fetch(`${apiBase()}/admin/tools/${id}`, { method: "DELETE" });
    toast({ title: "Đã xóa" }); void load();
  };

  const toggle = async (tool: Tool) => {
    await fetch(`${apiBase()}/admin/tools/${tool.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !tool.isActive }) });
    void load();
  };

  const openEdit = (tool: Tool) => { setForm(tool); setSchemaStr(JSON.stringify(tool.inputSchema, null, 2)); setEditing(tool.id); setOpen(true); };

  const builtin = items.filter(t => t.isBuiltin);
  const custom = items.filter(t => !t.isBuiltin);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Tools</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Công cụ dùng chung cho chatbot</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setSchemaStr(DEFAULT_SCHEMA); setOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Thêm tool</span>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          {builtin.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tools tích hợp sẵn</h3>
              <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {builtin.map(tool => (
                  <Card key={tool.id} className="p-3 sm:p-4 space-y-2 border-primary/20">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-mono text-xs sm:text-sm font-semibold truncate flex-1">{tool.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">Builtin</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEdit(tool)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => void toggle(tool)}>
                        {tool.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {custom.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tools tùy chỉnh</h3>
              <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {custom.map(tool => (
                  <Card key={tool.id} className="p-3 sm:p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 shrink-0" />
                      <span className="font-mono text-xs sm:text-sm font-semibold truncate flex-1">{tool.name}</span>
                      <Badge variant={tool.isActive ? "default" : "secondary"} className="text-[10px] shrink-0">
                        {tool.isActive ? "Bật" : "Tắt"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEdit(tool)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => void toggle(tool)}>
                        {tool.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive" onClick={() => void del(tool.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Chưa có tool nào.</p>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editing ? "Sửa tool" : "Thêm tool mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Tên tool (function name) *</Label>
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value.replace(/\s/g, "_") }))} placeholder="vd: get_product_info" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Trạng thái</Label>
                <div className="flex items-center gap-2 h-10">
                  <input type="checkbox" id="active" checked={form.isActive ?? true} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="active" className="text-sm">Kích hoạt</label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Mô tả (AI sẽ đọc để biết khi nào dùng)</Label>
              <Textarea value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Mô tả chức năng tool..." className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Input Schema (JSON)</Label>
              <Textarea value={schemaStr} onChange={e => setSchemaStr(e.target.value)} rows={6} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Implementation (JavaScript)</Label>
              <Textarea value={form.implementation ?? ""} onChange={e => setForm(f => ({ ...f, implementation: e.target.value }))} rows={6} className="font-mono text-xs" placeholder="// Logic xử lý&#10;return `Kết quả: ${input.param}`;" />
              <p className="text-xs text-muted-foreground">Code JS chạy trong sandbox. Có thể dùng fetch() để gọi API ngoài.</p>
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
