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
import { useWebhookBase } from "@/hooks/use-webhook-base";

interface Connection {
  id: number; name: string; type: string; config: Record<string, string>;
  status: string; lastConnectedAt: string | null; isActive: boolean; createdAt: string;
}

const EMPTY: Partial<Connection> = { name: "", type: "zalo", config: {}, isActive: true };

const TYPE_LABELS: Record<string, string> = {
  zalo: "Zalo Bot", messenger: "Facebook Messenger",
  xiaozhi: "Xiaozhi (WebSocket)", webhook: "Webhook tùy chỉnh", websocket: "WebSocket tùy chỉnh",
};

const STATUS_COLOR: Record<string, string> = {
  connected: "bg-green-500", disconnected: "bg-gray-400", error: "bg-red-500", connecting: "bg-yellow-400",
};

export default function ConnectionsPage() {
  const webhookBase = useWebhookBase();
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
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setItems(await r.json() as Connection[]);
    } catch (err) {
      console.error("[connections] load failed:", err);
      toast({ title: "Không thể tải kết nối — kiểm tra server", variant: "destructive" });
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    try {
      const url = editing ? `${apiBase()}/admin/connections/${editing}` : `${apiBase()}/admin/connections`;
      const r = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, config: configStr }) });
      if (!r.ok) throw new Error("Lỗi lưu");
      toast({ title: editing ? "Đã cập nhật" : "Đã tạo kết nối" });
      setOpen(false); setEditing(null); setForm(EMPTY); setConfigStr({}); void load();
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
      toast({ title: `Kết nối thành công: ${conn.name}` }); void load();
    } catch (err) {
      toast({ title: `Lỗi: ${err instanceof Error ? err.message : String(err)}`, variant: "destructive" });
      void load();
    } finally { setConnecting(null); }
  };

  const disconnect = async (conn: Connection) => {
    await fetch(`${apiBase()}/admin/connections/${conn.id}/disconnect`, { method: "POST" });
    toast({ title: "Đã ngắt kết nối" }); void load();
  };

  const openEdit = (conn: Connection) => { setForm(conn); setConfigStr(conn.config ?? {}); setEditing(conn.id); setOpen(true); };
  const copy = (text: string) => { void navigator.clipboard.writeText(text); toast({ title: "Đã sao chép!" }); };

  const selectedType = form.type ?? "zalo";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Kết nối</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Zalo OA, Messenger, Xiaozhi WebSocket...</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setConfigStr({}); setOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Thêm kết nối</span>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Đang tải...</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Chưa có kết nối nào</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {items.map(conn => (
            <Card key={conn.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${STATUS_COLOR[conn.status] ?? "bg-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{conn.name}</span>
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[conn.type] ?? conn.type}</Badge>
                    <Badge variant={conn.status === "connected" ? "default" : "secondary"} className="text-[10px] capitalize">{conn.status}</Badge>
                  </div>
                  {conn.lastConnectedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">Lần cuối: {new Date(conn.lastConnectedAt).toLocaleString("vi-VN")}</p>
                  )}
                </div>
              </div>

              {(conn.type === "zalo" || conn.type === "messenger") && conn.status === "connected" && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-blue-400">Webhook URL:</p>
                  <div className="flex items-start gap-2">
                    <code className="text-xs text-blue-300 flex-1 break-all leading-relaxed">
                      {webhookBase}/api/webhooks/{conn.type}
                    </code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 mt-0.5" onClick={() => copy(`${webhookBase}/api/webhooks/${conn.type}`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {conn.status !== "connected" ? (
                  <Button size="sm" className="flex-1 h-8" onClick={() => void connect(conn)} disabled={connecting === conn.id}>
                    {connecting === conn.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Wifi className="h-3.5 w-3.5 mr-1.5" />}
                    Kết nối
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => void disconnect(conn)}>
                    <WifiOff className="h-3.5 w-3.5 mr-1.5" /> Ngắt
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEdit(conn)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive" onClick={() => void del(conn.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editing ? "Sửa kết nối" : "Thêm kết nối mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Tên *</Label>
              <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Zalo SmartHomeQ" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Loại</Label>
              <Select value={selectedType} onValueChange={v => { setForm(f => ({ ...f, type: v })); setConfigStr({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {selectedType === "zalo" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Bot Access Token</Label>
                  <Input value={configStr.accessToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, accessToken: e.target.value }))} placeholder="OA_ID:token (từ chatbot.zalo.me)" className="font-mono text-xs" />
                  <p className="text-[11px] text-muted-foreground">Lấy tại chatbot.zalo.me → chọn bot → Cài đặt → Access Token</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Secret Token (OA Secret)</Label>
                  <Input value={configStr.secretToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, secretToken: e.target.value }))} placeholder="Secret token xác thực webhook" className="font-mono text-xs" />
                  <p className="text-[11px] text-muted-foreground">Lấy tại Zalo OA → Quản lý ứng dụng → Secret Token</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-blue-400">Webhook URL — dán vào Zalo Bot dashboard:</p>
                  <div className="flex items-start gap-2">
                    <code className="text-xs text-blue-300 flex-1 break-all leading-relaxed">{webhookBase}/api/webhooks/zalo</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copy(`${webhookBase}/api/webhooks/zalo`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  {webhookBase.includes("spock.replit.dev") && (
                    <p className="text-[11px] text-yellow-400 bg-yellow-500/10 rounded px-2 py-1.5">
                      Đây là URL dev. Sau khi publish, mở app production để lấy URL thật để dán vào Zalo Bot.
                    </p>
                  )}
                  <div className="flex gap-3">
                    <a href="https://chatbot.zalo.me" target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                      <ExternalLink className="h-3 w-3" /> Zalo Bot Dashboard
                    </a>
                    <a href="https://oa.zalo.me/manage" target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                      <ExternalLink className="h-3 w-3" /> Zalo OA Manager
                    </a>
                  </div>
                </div>
              </div>
            )}

            {selectedType === "messenger" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Page Access Token</Label>
                  <Input value={configStr.pageToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, pageToken: e.target.value }))} placeholder="EAA..." className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Verify Token</Label>
                  <Input value={configStr.verifyToken ?? ""} onChange={e => setConfigStr(s => ({ ...s, verifyToken: e.target.value }))} placeholder="Token xác thực webhook" className="font-mono text-xs" />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-400">Webhook URL (dán vào Meta Developer):</p>
                  <div className="flex items-start gap-2">
                    <code className="text-xs text-blue-300 flex-1 break-all leading-relaxed">{webhookBase}/api/webhooks/messenger</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copy(`${webhookBase}/api/webhooks/messenger`)}>
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
                <Label className="text-sm">WebSocket URL</Label>
                <Input value={configStr.wsUrl ?? ""} onChange={e => setConfigStr(s => ({ ...s, wsUrl: e.target.value }))} placeholder="wss://api.xiaozhi.me/mcp/?token=..." className="font-mono text-xs" />
              </div>
            )}

            {(selectedType === "webhook" || selectedType === "websocket") && (
              <div className="space-y-1.5">
                <Label className="text-sm">URL</Label>
                <Input value={configStr.url ?? ""} onChange={e => setConfigStr(s => ({ ...s, url: e.target.value }))} placeholder="https:// hoặc wss://" className="font-mono text-xs" />
              </div>
            )}
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
