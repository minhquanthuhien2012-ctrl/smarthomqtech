import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, CheckCircle, XCircle, ChevronLeft, X } from "lucide-react";
import { useLocation } from "wouter";
import { apiUrl, authHeaders } from "@/lib/auth";

interface UserConnection {
  id: number;
  type: string;
  name: string;
  config: Record<string, string>;
  status: string;
  isActive: boolean;
}

const BOT_TYPES = [
  { type: "zalo", label: "Zalo OA Bot", icon: "💬", fields: [
    { key: "accessToken", label: "Access Token", placeholder: "OA Access Token" },
    { key: "oaSecret", label: "OA Secret Key", placeholder: "Secret từ Zalo OA" },
    { key: "webhookUrl", label: "Webhook URL (copy để cấu hình)", placeholder: "Tự sinh sau khi lưu", readOnly: true },
  ]},
  { type: "telegram", label: "Telegram Bot", icon: "✈️", fields: [
    { key: "botToken", label: "Bot Token", placeholder: "Token từ @BotFather" },
    { key: "webhookUrl", label: "Webhook URL", placeholder: "Tự sinh sau khi lưu", readOnly: true },
  ]},
  { type: "facebook", label: "Facebook Messenger", icon: "📘", fields: [
    { key: "pageAccessToken", label: "Page Access Token", placeholder: "Token trang Facebook" },
    { key: "verifyToken", label: "Verify Token", placeholder: "Token xác minh webhook" },
    { key: "webhookUrl", label: "Webhook URL", placeholder: "Tự sinh sau khi lưu", readOnly: true },
  ]},
  { type: "xiaozhi", label: "Xiaozhi WebSocket", icon: "🤖", fields: [
    { key: "wsEndpoint", label: "WebSocket Endpoint", placeholder: "ws://api.xiaozhi.me/mcp/?token=..." },
  ]},
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [, navigate] = useLocation();

  async function load() {
    setLoading(true);
    const data = await fetch(apiUrl("/api/user/connections"), { headers: authHeaders() }).then(r => r.json()).catch(() => []) as UserConnection[];
    setConnections(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: number) {
    if (!confirm("Xoá kết nối này?")) return;
    await fetch(apiUrl(`/api/user/connections/${id}`), { method: "DELETE", headers: authHeaders() });
    await load();
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm shrink-0">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="font-semibold text-sm">Kết nối Bot</div>
          <div className="text-xs text-muted-foreground">Zalo, Telegram, Facebook, Xiaozhi</div>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
          <Plus className="h-4 w-4" />Thêm
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : connections.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
            <div className="text-4xl">🔗</div>
            <p>Chưa có kết nối nào</p>
            <p className="text-xs">Kết nối Zalo/Telegram/Facebook/Xiaozhi để AI trả lời tự động</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs text-white font-medium hover:bg-primary/90 transition-colors">
              <Plus className="h-3.5 w-3.5" />Thêm kết nối đầu tiên
            </button>
          </div>
        ) : (
          connections.map(conn => {
            const meta = BOT_TYPES.find(b => b.type === conn.type);
            return (
              <div key={conn.id} className="rounded-2xl border bg-card shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{meta?.icon ?? "🔗"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{conn.name || meta?.label}</span>
                      {conn.status === "connected"
                        ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" />Đã kết nối</span>
                        : <span className="flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" />Chưa kết nối</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{conn.type}</p>
                  </div>
                  <button onClick={() => remove(conn.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showAdd && <AddConnectionModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddConnectionModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = BOT_TYPES.find(b => b.type === selectedType);

  async function save() {
    if (!selectedType) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/user/connections"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ type: selectedType, name: name || meta?.label, config }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Lỗi"); return; }
      onAdded();
    } catch { setError("Không thể kết nối server"); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <p className="font-semibold text-sm">Thêm kết nối Bot</p>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Chọn loại bot</label>
            <div className="grid grid-cols-2 gap-2">
              {BOT_TYPES.map(b => (
                <button key={b.type} onClick={() => { setSelectedType(b.type); setConfig({}); }}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors text-left ${
                    selectedType === b.type ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/30"
                  }`}>
                  <span className="text-xl">{b.icon}</span>
                  <span className="text-xs leading-tight">{b.label}</span>
                </button>
              ))}
            </div>
          </div>

          {meta && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tên kết nối</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder={meta.label}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {meta.fields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                  <input value={config[f.key] ?? ""} onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} readOnly={"readOnly" in f && f.readOnly}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono ${"readOnly" in f && f.readOnly ? "bg-muted/30 text-muted-foreground text-xs" : ""}`} />
                </div>
              ))}
            </>
          )}

          {error && <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</p>}

          <button onClick={save} disabled={!selectedType || saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Đang lưu..." : "Lưu kết nối"}
          </button>
        </div>
      </div>
    </div>
  );
}
