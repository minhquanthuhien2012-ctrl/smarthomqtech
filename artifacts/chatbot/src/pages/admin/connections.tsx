import { useState, useEffect } from "react";
import { Plus, Link2, Pencil, Trash2, Wifi, WifiOff, RefreshCw, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/api";

interface Connection {
  id: number;
  name: string;
  type: string;
  config: Record<string, string>;
  status: string;
  lastConnectedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

const EMPTY: Partial<Connection> = { name: "", type: "zalo", config: {}, isActive: true };

const TYPE_LABELS: Record<string, string> = {
  zalo: "Zalo OA",
  messenger: "Facebook Messenger",
  xiaozhi: "Xiaozhi (WebSocket)",
  webhook: "Webhook tùy chỉnh",
  websocket: "WebSocket tùy chỉnh",
};

const STATUS_COLOR: Record<string, string> = {
  connected: "bg-green-500",
  disconnected: "bg-gray-400",
  error: "bg-red-500",
  connecting: "bg-yellow-400",
};

const WEBHOOK_BASE = typeof window !== "undefined" ? window.location.origin : "";

export default function ConnectionsPage() {
  const [items, setItems] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Connection>>(EMPTY);
  const [configStr, setConfigStr] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [connecting, setConnecting] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase()}/admin/connections`);
      setItems(await r.json() as Connection[]);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    try {
      const url = editing ? `${apiBase()}/admin/connections/${editing}` : `${apiBase()}/admin/connections`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, config: configStr }) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editing ? "Đã cập nhật" : "Đã tạo kết nối" });
      setOpen(false); setEditing(null); setForm(EMPTY); setConfigStr({});
      void load();
    } catch { toast({ title: "Lỗi", variant: "destructive" }); }
  };

  const del = async (id: number) => {
    if (!confirm("Xóa kết nối này?")) return;
    await fetch(`${apiBase()}/admin/connections/${id}`, { method: "DELETE" });
    toast({ title: "Đã xóa" }); void load();
  };

  const connect = async (conn: Connection) => {
    setConnecting(conn.id);
    try {
      const r = await fetch(`${apiBase()}/admin/connections/${conn.id}/connect`, { method: "POST" });
      const data = await r.json() as { status: string; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Lỗi kết nối");
      toast({ title: `Kết nối thành công: ${conn.name}` });
      void load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: `Lỗi: ${msg}`, variant: "destructive" });
      void load();
    } finally { setConnecting(null); }
  };

  const disconnect = async (conn: Connection) => {
    await fetch(`${apiBase()}/admin/connections/${conn.id}/disconnect`, { method: "POST" });
    toast({ title: "Đã ngắt kết nối" }); void load();
  };

  const openEdit = (conn: Connection) => {
    setForm(conn); setConfigStr(conn.config ?? {}); setEditing(conn.id); setOpen(true);
  };

  const copy = (text: string) => { void navigator.clipboard.writeText(text); toast({ title: "Đã sao chép!" }); };

  const selectedType = form.type ?? "zalo";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kết nối</h2>
          <p className="text-muted-foreground text-sm">Zalo OA, Messenger, Xiaozhi WebSocket...</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditing(null); setConfigStr({}); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Thêm kết nối
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Chưa có kết nối nào</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(conn => (
            <Card key={conn.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${STATUS_COLOR[conn.status] ?? "bg-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{conn.name}</span>
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[conn.type] ?? conn.type}</Badge>
                    <Badge variant={conn.status === "connected" ? "default" : "secondary"} className="text-xs capitalize">{conn.status}</Badge>
                  </div>
                  {conn.lastConnectedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">Lần cuối: {new Date(conn.lastConnectedAt).toLocaleString("vi-VN")}</p>
                  )}
                </div>
              </div>

              {(conn.type === "zalo" || conn.type === "messenger") && conn.status === "connected" && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-blue-400">Webhook URL — cấu hình trên {TYPE_LABELS[conn.type]}:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-blue-300 flex-1 break-all">
                      {WEBHOOK_BASE}/api/webhooks/{conn.type}
                    </code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copy(`${WEBHOOK_BASE}/api/webhooks/${conn.type}`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {conn.status !== "connected" ? (
                  <Button size="sm" className="flex-1" onClick={() => void connect(conn)} disabled={connecting === conn.id}>
                    {connecting === conn.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Wifi className="h-3.5 w-3.5 mr-1.5" />}
                    Kết nối
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => void disconnect(conn)}>
                    <WifiOff className="h-3.5 w-3.5 mr-1.5" /> Ngắt
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(conn)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => void del(conn.id)}>
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
            <DialogTitle>{editing ? "Sửa kết nối" : "Thêm kết nối mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tên *</Label>
              <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Zalo SmartHomeQ" />
            </div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={selectedType} onValueChange={v => { setForm(f => ({ ...f, type: v })); setConfigStr({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selectedType === "zalo" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Access Token (HTTP API)</Label>
                  <Input value={configStr.accessToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, accessToken: e.target.value }))} placeholder="Token tích hợp HTTP API" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label>Secret Token</Label>
                  <Input value={configStr.secretToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, secretToken: e.target.value }))} placeholder="Secret token webhook" className="font-mono text-xs" />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-400">Webhook URL (dán vào Zalo OA):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-blue-300 flex-1 break-all">{WEBHOOK_BASE}/api/webhooks/zalo</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copy(`${WEBHOOK_BASE}/api/webhooks/zalo`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <a href="https://developers.zalo.me/app" target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Zalo Developer Console
                  </a>
                </div>
              </div>
            )}

            {selectedType === "messenger" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Page Access Token</Label>
                  <Input value={configStr.pageToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, pageToken: e.target.value }))} placeholder="EAA..." className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label>Verify Token</Label>
                  <Input value={configStr.verifyToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, verifyToken: e.target.value }))} placeholder="Token xác thực webhook" className="font-mono text-xs" />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-400">Webhook URL (dán vào Meta Developer):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-blue-300 flex-1 break-all">{WEBHOOK_BASE}/api/webhooks/messenger</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copy(`${WEBHOOK_BASE}/api/webhooks/messenger`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Meta Developer Console
                  </a>
                </div>
              </div>
            )}

            {selectedType === "xiaozhi" && (
              <div className="space-y-1.5">
                <Label>WebSocket URL</Label>
                <Input value={configStr.wsUrl ?? ""} onChange={e => setConfigStr(s => ({ ...s, wsUrl: e.target.value }))} placeholder="wss://api.xiaozhi.me/mcp/?token=..." className="font-mono text-xs" />
              </div>
            )}

            {(selectedType === "webhook" || selectedType === "websocket") && (
              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input value={configStr.url ?? ""} onChange={e => setConfigStr(s => ({ ...s, url: e.target.value }))} placeholder="https:// hoặc wss://" className="font-mono text-xs" />
              </div>
            )}
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
