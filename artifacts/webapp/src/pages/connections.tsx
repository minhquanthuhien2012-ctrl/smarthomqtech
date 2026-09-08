import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, CheckCircle, XCircle, ChevronLeft, X, Facebook, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";
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

interface FacebookPage {
  id: string;
  name: string;
  pictureUrl: string;
  tasks: string[];
}

interface FacebookPagesResponse {
  connected: boolean;
  connectionId?: number;
  pages: FacebookPage[];
  selectedPageId: string;
  status?: string;
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
  { type: "xiaozhi", label: "Xiaozhi WebSocket", icon: "🤖", fields: [
    { key: "wsEndpoint", label: "WebSocket Endpoint", placeholder: "ws://api.xiaozhi.me/mcp/?token=..." },
  ]},
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [facebook, setFacebook] = useState<FacebookPagesResponse | null>(null);
  const [facebookLoading, setFacebookLoading] = useState(true);
  const [facebookBusy, setFacebookBusy] = useState(false);
  const [facebookMessage, setFacebookMessage] = useState("");
  const [, navigate] = useLocation();

  async function load() {
    setLoading(true);
    const data = await fetch(apiUrl("/api/user/connections"), { headers: authHeaders() }).then(r => r.json()).catch(() => []) as UserConnection[];
    setConnections(data);
    setLoading(false);
  }

  async function loadFacebook() {
    setFacebookLoading(true);
    const data = await fetch(apiUrl("/api/facebook/pages"), { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null) as FacebookPagesResponse | null;
    setFacebook(data);
    setFacebookLoading(false);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("facebook");
    if (result === "connected") setFacebookMessage("Facebook đã kết nối. Hãy chọn Page để quản lý.");
    if (result === "error") setFacebookMessage("Không thể kết nối Facebook. Hãy kiểm tra quyền ứng dụng Meta và thử lại.");
    if (result) window.history.replaceState({}, "", window.location.pathname);
    load();
    loadFacebook();
  }, []);

  async function remove(id: number) {
    if (!confirm("Xoá kết nối này?")) return;
    await fetch(apiUrl(`/api/user/connections/${id}`), { method: "DELETE", headers: authHeaders() });
    await load();
  }

  async function connectFacebook() {
    setFacebookBusy(true);
    setFacebookMessage("");
    try {
      const res = await fetch(apiUrl("/api/facebook/oauth/start"), { headers: authHeaders() });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setFacebookMessage(data.error || "Facebook OAuth chưa được cấu hình.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setFacebookMessage("Không thể bắt đầu kết nối Facebook.");
    } finally {
      setFacebookBusy(false);
    }
  }

  async function selectFacebookPage(pageId: string) {
    setFacebookBusy(true);
    setFacebookMessage("");
    try {
      const res = await fetch(apiUrl("/api/facebook/pages/select"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setFacebookMessage(data.error || "Không thể chọn Page.");
        return;
      }
      await Promise.all([loadFacebook(), load()]);
      setFacebookMessage("Đã chọn Page quản lý.");
    } catch {
      setFacebookMessage("Không thể lưu Page đang chọn.");
    } finally {
      setFacebookBusy(false);
    }
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
        <section className="rounded-2xl border border-[#dbe7f5] bg-gradient-to-br from-[#f5f9ff] to-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1877f2] text-white">
              <Facebook className="h-6 w-6 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Facebook Pages</h2>
                {facebook?.connected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    <CheckCircle className="h-3 w-3" />Đã kết nối
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Kết nối tài khoản Facebook của bạn để chọn và quản lý các Page riêng tư, không dùng chung với người dùng khác.
              </p>
            </div>
            <button
              onClick={facebook?.connected ? loadFacebook : connectFacebook}
              disabled={facebookBusy || facebookLoading}
              title={facebook?.connected ? "Làm mới danh sách Page" : "Đăng nhập với Facebook"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1877f2] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166fe5] disabled:opacity-50"
            >
              {facebookBusy || facebookLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : facebook?.connected ? <RefreshCw className="h-3.5 w-3.5" /> : <Facebook className="h-3.5 w-3.5 fill-current" />}
              <span className="hidden sm:inline">{facebook?.connected ? "Làm mới" : "Đăng nhập Facebook"}</span>
            </button>
          </div>

          {facebookMessage && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {facebookMessage}
            </div>
          )}

          {facebook?.connected && facebook.pages.length === 0 && (
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              Tài khoản Facebook đã kết nối nhưng chưa có Page khả dụng hoặc ứng dụng chưa được cấp quyền Page.
            </div>
          )}

          {facebook?.connected && facebook.pages.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Chọn Page đang quản lý</p>
                <span className="text-[10px] text-muted-foreground">{facebook.pages.length} Page</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {facebook.pages.map(page => {
                  const selected = page.id === facebook.selectedPageId;
                  return (
                    <button
                      key={page.id}
                      onClick={() => selectFacebookPage(page.id)}
                      disabled={facebookBusy}
                      className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
                        selected ? "border-[#1877f2] bg-[#1877f2]/5 ring-1 ring-[#1877f2]/20" : "bg-white hover:border-[#8bb8f5]"
                      }`}
                    >
                      {page.pictureUrl ? (
                        <img src={page.pictureUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f1ff] text-xs font-bold text-[#1877f2]">{page.name.slice(0, 1)}</div>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{page.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{page.tasks.length ? `${page.tasks.length} quyền được cấp` : "Quyền Page đang được kiểm tra"}</span>
                      </span>
                      {selected && <CheckCircle className="h-4 w-4 shrink-0 text-[#1877f2]" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Token được xử lý ở máy chủ và không hiển thị trong trình duyệt.
              </div>
            </div>
          )}
        </section>

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
