import { useState, useEffect } from "react";
import { Globe, Plus, Trash2, RefreshCw, FileText, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp, ExternalLink, AlertCircle } from "lucide-react";
import { apiJson } from "@/lib/api";

interface Site {
  id: number;
  name: string;
  url: string;
  siteType: string;
  isMain: boolean;
  wooConsumerKey?: string | null;
  wooConsumerSecret?: string | null;
  lastScrapedAt?: string | null;
  status: string;
}

interface Draft {
  id: number;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  siteId?: number | null;
}

type Tab = "main" | "sub" | "drafts";

export default function WebscraperPage() {
  const [tab, setTab] = useState<Tab>("main");

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">Quản lý Web Site</div>
          <div className="text-xs text-muted-foreground">Scrape & tổng hợp nội dung AI</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        {([
          { key: "main", label: "Web Chính" },
          { key: "sub", label: "Web Phụ" },
          { key: "drafts", label: "Chờ Duyệt" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "main" && <SitesTab isMain={true} />}
        {tab === "sub" && <SitesTab isMain={false} />}
        {tab === "drafts" && <DraftsTab />}
      </div>
    </div>
  );
}

function SitesTab({ isMain }: { isMain: boolean }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", wooConsumerKey: "", wooConsumerSecret: "" });
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const all = await apiJson<Site[]>("/api/admin/webscraper/sites");
      setSites(all.filter((s) => s.isMain === isMain));
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [isMain]);

  async function addSite() {
    if (!form.name || !form.url) return;
    setSaving(true);
    try {
      await apiJson("/api/admin/webscraper/sites", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          url: form.url,
          isMain,
          wooConsumerKey: form.wooConsumerKey || null,
          wooConsumerSecret: form.wooConsumerSecret || null,
        }),
      });
      setForm({ name: "", url: "", wooConsumerKey: "", wooConsumerSecret: "" });
      setShowAdd(false);
      await load();
    } catch {}
    setSaving(false);
  }

  async function deleteSite(id: number) {
    if (!confirm("Xóa site này?")) return;
    try {
      await apiJson(`/api/admin/webscraper/sites/${id}`, { method: "DELETE" });
      await load();
    } catch {}
  }

  async function doAction(siteId: number, action: "analyze" | "scrape" | "template" | "generate") {
    setActionId(siteId);
    setActionType(action);
    try {
      if (action === "generate") {
        await apiJson("/api/admin/webscraper/generate", {
          method: "POST",
          body: JSON.stringify({ siteId, count: 3 }),
        });
      } else {
        await apiJson(`/api/admin/webscraper/sites/${siteId}/${action}`, { method: "POST" });
      }
      await load();
    } catch {}
    setActionId(null);
    setActionType("");
  }

  const isActing = (id: number, type: string) => actionId === id && actionType === type;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 py-3 text-sm text-primary hover:border-primary/70 hover:bg-primary/5 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Thêm {isMain ? "web chính" : "web phụ"}
      </button>

      {showAdd && (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <p className="font-medium text-sm">Thêm {isMain ? "Web Chính" : "Web Phụ"}</p>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Tên site"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="URL (https://...)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          {!isMain && (
            <>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="WooCommerce Consumer Key (nếu có)"
                value={form.wooConsumerKey}
                onChange={(e) => setForm({ ...form, wooConsumerKey: e.target.value })}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="WooCommerce Consumer Secret (nếu có)"
                type="password"
                value={form.wooConsumerSecret}
                onChange={(e) => setForm({ ...form, wooConsumerSecret: e.target.value })}
              />
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={addSite}
              disabled={saving || !form.name || !form.url}
              className="flex-1 rounded-lg bg-primary py-2 text-sm text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 rounded-lg border py-2 text-sm hover:bg-muted transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {sites.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Globe className="h-10 w-10 mx-auto mb-2 opacity-30" />
          Chưa có {isMain ? "web chính" : "web phụ"} nào
        </div>
      ) : (
        sites.map((site) => (
          <div key={site.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === site.id ? null : site.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{site.name}</p>
                <p className="text-xs text-muted-foreground truncate">{site.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  site.status === "active" ? "bg-green-100 text-green-700" :
                  site.status === "error" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {site.siteType || site.status}
                </span>
                {expandedId === site.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {expandedId === site.id && (
              <div className="border-t px-4 py-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <a href={site.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{site.url}</a>
                </div>
                {site.lastScrapedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Scrape lần cuối: {new Date(site.lastScrapedAt).toLocaleString("vi-VN")}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <ActionButton label="Phân tích" loading={isActing(site.id, "analyze")} onClick={() => doAction(site.id, "analyze")} />
                  <ActionButton label="Scrape" loading={isActing(site.id, "scrape")} onClick={() => doAction(site.id, "scrape")} />
                  <ActionButton label="Tạo template" loading={isActing(site.id, "template")} onClick={() => doAction(site.id, "template")} />
                  <ActionButton label="Viết bài (AI)" loading={isActing(site.id, "generate")} onClick={() => doAction(site.id, "generate")} variant="primary" />
                </div>
                <button
                  onClick={() => deleteSite(site.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/40 py-1.5 text-xs text-destructive hover:bg-destructive/5 transition-colors mt-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa site
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ActionButton({ label, loading, onClick, variant = "default" }: {
  label: string;
  loading: boolean;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
        variant === "primary"
          ? "bg-primary text-white hover:bg-primary/90"
          : "border bg-white hover:bg-muted"
      }`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function DraftsTab() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<Draft[]>("/api/admin/webscraper/drafts");
      setDrafts(data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function publish(id: number) {
    setActingId(id);
    try {
      await apiJson(`/api/admin/webscraper/drafts/${id}/publish`, { method: "POST" });
      await load();
    } catch {}
    setActingId(null);
  }

  async function deleteDraft(id: number) {
    if (!confirm("Xóa bài này?")) return;
    try {
      await apiJson(`/api/admin/webscraper/drafts/${id}`, { method: "DELETE" });
      await load();
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>Chưa có bài nào chờ duyệt</p>
        <p className="text-xs mt-1">Vào tab Web Phụ → Viết bài (AI) để tạo bài mới</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {drafts.map((draft) => (
        <div key={draft.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div
            className="flex items-start gap-3 px-4 py-3 cursor-pointer"
            onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
          >
            <div className="mt-0.5">
              {draft.status === "published" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : draft.status === "error" ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Clock className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-snug line-clamp-2">{draft.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(draft.createdAt).toLocaleDateString("vi-VN")} · {draft.status === "published" ? "Đã đăng" : draft.status === "error" ? "Lỗi" : "Chờ duyệt"}
              </p>
            </div>
            {expandedId === draft.id ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
          </div>

          {expandedId === draft.id && (
            <div className="border-t px-4 py-3 space-y-3 bg-muted/30">
              <div className="max-h-48 overflow-y-auto rounded-lg bg-white border p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {draft.content}
              </div>
              {draft.status !== "published" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => publish(draft.id)}
                    disabled={actingId === draft.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    {actingId === draft.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Duyệt & Đăng
                  </button>
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
