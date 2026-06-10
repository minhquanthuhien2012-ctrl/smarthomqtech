import { useState, useEffect, useRef } from "react";
import { Globe, Plus, Loader2, ExternalLink, Edit3, PlusCircle, CheckCircle, Clock, Trash2, ChevronLeft, Sparkles, FileText, LayoutList, AlertCircle, X, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(p: string) { return `${BASE}${p}`; }

type Tab = "primary" | "source" | "drafts" | "catalog";

interface Site { id: number; url: string; name: string; type: string; role: string; credentials: Record<string, string>; categories: Array<{ name: string; url?: string }>; lastScrapedAt?: string | null; }
interface ScrapedItem { id: number; title: string; price: string; originalUrl: string; imageUrl: string; category: string; content: string; rawData?: Record<string, unknown>; }
interface Draft { id: number; title: string; content: string; status: string; targetCategory: string; publishedUrl: string; createdAt: string; }
interface FormField { key: string; label: string; type: "text" | "textarea"; required: boolean; value: string; }

export default function WebscraperPage() {
  const [tab, setTab] = useState<Tab>("primary");
  const tabs = [
    { key: "primary" as Tab, label: "Web Bán Hàng", icon: Globe },
    { key: "source" as Tab, label: "Web Nguồn", icon: FileText },
    { key: "drafts" as Tab, label: "Chờ Duyệt", icon: Clock },
    { key: "catalog" as Tab, label: "Danh Mục", icon: LayoutList },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shrink-0">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">Quản lý Web Site</div>
          <div className="text-xs text-muted-foreground">Scrape & tổng hợp nội dung AI</div>
        </div>
      </div>

      <div className="flex border-b bg-white shrink-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "primary" && <PrimaryTab />}
        {tab === "source" && <SourceTab />}
        {tab === "drafts" && <DraftsTab />}
        {tab === "catalog" && <CatalogTab />}
      </div>
    </div>
  );
}

function usePrimarySite() {
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  async function load() {
    const sites: Site[] = await fetch(apiUrl("/api/admin/webscraper/sites")).then(r => r.json()).catch(() => []);
    const primary = sites.find(s => s.role === "primary") ?? null;
    setSite(primary);
    setLoading(false);
    return primary;
  }
  useEffect(() => { load(); }, []);
  return { site, setSite, loading, reload: load };
}

function PrimaryTab() {
  const { site, setSite, loading, reload } = usePrimarySite();
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<{ type: string; name: string } | null>(null);
  const [credentials, setCredentials] = useState({ consumerKey: "", consumerSecret: "" });
  const [scraping, setScraping] = useState(false);
  const [items, setItems] = useState<ScrapedItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [editItem, setEditItem] = useState<ScrapedItem | null>(null);
  const [newProductItem, setNewProductItem] = useState<ScrapedItem | null>(null);

  useEffect(() => {
    if (site) {
      setUrl(site.url);
      setCredentials({
        consumerKey: site.credentials?.consumerKey ?? "",
        consumerSecret: site.credentials?.consumerSecret ?? "",
      });
      loadItems(site.id);
    }
  }, [site]);

  async function loadItems(id: number) {
    setItemsLoading(true);
    const data: ScrapedItem[] = await fetch(apiUrl(`/api/admin/webscraper/sites/${id}/items`)).then(r => r.json()).catch(() => []);
    setItems(data);
    setItemsLoading(false);
  }

  async function analyze() {
    if (!url) return;
    setAnalyzing(true);
    try {
      let siteObj = site;
      if (!siteObj) {
        const created: Site = await fetch(apiUrl("/api/admin/webscraper/sites"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, name: "", role: "primary" }),
        }).then(r => r.json());
        siteObj = created;
        setSite(created);
      } else {
        await fetch(apiUrl(`/api/admin/webscraper/sites/${siteObj.id}`), {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      }
      const res = await fetch(apiUrl(`/api/admin/webscraper/sites/${siteObj!.id}/analyze`), { method: "POST" }).then(r => r.json());
      setAnalyzed({ type: res.site?.type ?? "unknown", name: res.site?.name ?? url });
      await reload();
    } catch {}
    setAnalyzing(false);
  }

  async function saveAndScrape() {
    if (!site) return;
    setScraping(true);
    try {
      await fetch(apiUrl(`/api/admin/webscraper/sites/${site.id}`), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials: {
            consumerKey: credentials.consumerKey,
            consumerSecret: credentials.consumerSecret,
          },
        }),
      });
      await fetch(apiUrl(`/api/admin/webscraper/sites/${site.id}/scrape`), { method: "POST" });
      await loadItems(site.id);
      const s = await reload();
      if (s) {
        const name = s.name || new URL(s.url).hostname;
        const aiName = `AI nhân viên bán hàng ${name}`;
        localStorage.setItem("ai_business_name", aiName);
        window.dispatchEvent(new Event("ai_name_updated"));
      }
    } catch {}
    setScraping(false);
  }

  const isWoo = (analyzed?.type ?? site?.type) === "woocommerce";

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
        <p className="font-medium text-sm">Web bán hàng của bạn</p>
        <div className="flex gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://smarthomeq.tech"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={analyze} disabled={analyzing || !url}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0">
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Phân tích
          </button>
        </div>

        {(analyzed || site?.type) && (
          <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
            isWoo ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-600 border"
          }`}>
            Loại web: <strong>{analyzed?.type ?? site?.type}</strong>
            {analyzed?.name ? ` — ${analyzed.name}` : (site?.name ? ` — ${site.name}` : "")}
          </div>
        )}

        {isWoo && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">WooCommerce API (để lấy & cập nhật sản phẩm)</p>
            <input value={credentials.consumerKey} onChange={e => setCredentials(c => ({ ...c, consumerKey: e.target.value }))}
              placeholder="Consumer Key (ck_...)"
              className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
            <input value={credentials.consumerSecret} onChange={e => setCredentials(c => ({ ...c, consumerSecret: e.target.value }))}
              placeholder="Consumer Secret (cs_...)" type="password"
              className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
          </div>
        )}

        {site && (
          <button onClick={saveAndScrape} disabled={scraping}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scraping ? "Đang lấy thông tin..." : "Lưu & Lấy thông tin sản phẩm"}
          </button>
        )}
      </div>

      {itemsLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : items.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{items.length} sản phẩm</p>
          {items.map(item => (
            <ProductCard key={item.id} item={item}
              onEdit={() => setEditItem(item)}
              onNew={() => setNewProductItem(item)} />
          ))}
        </div>
      ) : site && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Chưa có sản phẩm — bấm Lấy thông tin
        </div>
      )}

      {editItem && site && (
        <EditProductModal item={editItem} site={site}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); loadItems(site.id); }} />
      )}
      {newProductItem && site && (
        <NewProductModal item={newProductItem} site={site}
          onClose={() => setNewProductItem(null)}
          onCreated={() => { setNewProductItem(null); }} />
      )}
    </div>
  );
}

function ProductCard({ item, onEdit, onNew }: { item: ScrapedItem; onEdit: () => void; onNew: () => void }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex gap-3 p-3">
        {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-lg object-cover shrink-0 border" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug line-clamp-2">{item.title}</p>
          {item.price && <p className="text-xs text-primary font-semibold mt-0.5">{item.price}</p>}
          {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
        </div>
      </div>
      <div className="flex border-t divide-x text-xs">
        {item.originalUrl && (
          <a href={item.originalUrl} target="_blank" rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1 py-2 text-muted-foreground hover:bg-muted transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />Xem
          </a>
        )}
        <button onClick={onEdit} className="flex flex-1 items-center justify-center gap-1 py-2 text-muted-foreground hover:bg-muted transition-colors">
          <Edit3 className="h-3.5 w-3.5" />Sửa
        </button>
        <button onClick={onNew} className="flex flex-1 items-center justify-center gap-1 py-2 text-primary hover:bg-primary/5 transition-colors font-medium">
          <PlusCircle className="h-3.5 w-3.5" />Tạo mới
        </button>
      </div>
    </div>
  );
}

function EditProductModal({ item, site, onClose, onSaved }: { item: ScrapedItem; site: Site; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: item.title, price: item.price, content: item.content, category: item.category });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>("");

  async function save() {
    setSaving(true);
    setResult("");
    try {
      const res = await fetch(apiUrl(`/api/admin/webscraper/sites/${site.id}/woo-update/${item.id}`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(r => r.json());
      if (res.wooSync) setResult("✅ Đã cập nhật lên WooCommerce!");
      else setResult(`💾 Đã lưu cục bộ${res.wooError ? ` (WooCommerce: ${res.wooError})` : ""}`);
      setTimeout(() => { onSaved(); }, 1500);
    } catch { setResult("❌ Có lỗi xảy ra"); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <p className="font-semibold text-sm">Sửa sản phẩm</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Tên sản phẩm" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} />
          <Field label="Giá" value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} />
          <Field label="Danh mục" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} />
          <Field label="Mô tả" value={form.content} onChange={v => setForm(f => ({ ...f, content: v }))} multiline />
          {result && <p className="text-xs bg-muted rounded-lg p-2.5">{result}</p>}
          <button onClick={save} disabled={saving}
            className="w-full rounded-lg bg-primary py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Đang lưu..." : "Lưu & Cập nhật"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProductModal({ item, site, onClose, onCreated }: { item: ScrapedItem; site: Site; onClose: () => void; onCreated: () => void }) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [loadingForm, setLoadingForm] = useState(true);
  const [quickFilling, setQuickFilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => { loadForm(false); }, []);

  async function loadForm(quick: boolean) {
    setLoadingForm(true);
    if (quick) setQuickFilling(true);
    try {
      const data = await fetch(apiUrl(`/api/admin/webscraper/sites/${site.id}/product-form`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, quickFill: quick }),
      }).then(r => r.json()) as { fields?: FormField[] };
      setFields(data.fields ?? []);
    } catch {}
    setLoadingForm(false);
    setQuickFilling(false);
  }

  function update(key: string, value: string) {
    setFields(f => f.map(field => field.key === key ? { ...field, value } : field));
  }

  async function create() {
    setSaving(true);
    const body: Record<string, string> = {};
    for (const f of fields) body[f.key] = f.value;
    try {
      const res = await fetch(apiUrl(`/api/admin/webscraper/sites/${site.id}/woo-create`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json());
      setResult(res.created ? "✅ Đã tạo sản phẩm trên WooCommerce!" : "💾 Đã lưu vào Chờ duyệt");
      setTimeout(() => { onCreated(); }, 1500);
    } catch { setResult("❌ Có lỗi xảy ra"); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <p className="font-semibold text-sm">Tạo sản phẩm mới</p>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="p-4 space-y-3">
          {loadingForm ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <>
              <button onClick={() => loadForm(true)} disabled={quickFilling}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary/40 py-2 text-xs text-primary font-medium hover:bg-primary/5 disabled:opacity-50 transition-colors">
                {quickFilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI hỗ trợ nhập nhanh
              </button>
              {fields.map(f => (
                <Field key={f.key} label={f.label + (f.required ? " *" : "")} value={f.value} onChange={v => update(f.key, v)} multiline={f.type === "textarea"} />
              ))}
              {result && <p className="text-xs bg-muted rounded-lg p-2.5">{result}</p>}
              <button onClick={create} disabled={saving}
                className="w-full rounded-lg bg-primary py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                {saving ? "Đang tạo..." : "Tạo sản phẩm"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceTab() {
  const [url, setUrl] = useState("");
  const [siteId, setSiteId] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<string>("");
  const [scraping, setScraping] = useState(false);
  const [items, setItems] = useState<ScrapedItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");

  async function analyzeSource() {
    if (!url) return;
    setAnalyzing(true);
    setResult("");
    try {
      const created: Site = await fetch(apiUrl("/api/admin/webscraper/sites"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name: "", role: "secondary" }),
      }).then(r => r.json());
      setSiteId(created.id);
      const res = await fetch(apiUrl(`/api/admin/webscraper/sites/${created.id}/analyze`), { method: "POST" }).then(r => r.json());
      setAnalyzed(res.site?.type ?? "unknown");
      await fetch(apiUrl(`/api/admin/webscraper/sites/${created.id}/scrape`), { method: "POST" });
      const data: ScrapedItem[] = await fetch(apiUrl(`/api/admin/webscraper/sites/${created.id}/items`)).then(r => r.json());
      setItems(data);
      setSelected(new Set());
    } catch { setAnalyzed("error"); }
    setAnalyzing(false);
    setScraping(false);
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  }

  function toggle(id: number) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  async function generate() {
    if (!siteId || selected.size === 0) return;
    setGenerating(true);
    setResult("");
    try {
      const res = await fetch(apiUrl("/api/admin/webscraper/generate"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, itemIds: Array.from(selected) }),
      }).then(r => r.json());
      setResult(`✅ Đã tạo ${res.count} bài — xem ở tab Chờ Duyệt`);
      setSelected(new Set());
    } catch { setResult("❌ Có lỗi xảy ra"); }
    setGenerating(false);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
        <p className="font-medium text-sm">Web nguồn lấy thông tin</p>
        <div className="flex gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://nguon.com/san-pham"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={analyzeSource} disabled={analyzing || !url}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0">
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Phân tích & Lấy
          </button>
        </div>
        {analyzed && <p className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-2">Loại web: <strong>{analyzed}</strong></p>}
        {result && <p className="text-xs bg-muted rounded-lg px-3 py-2">{result}</p>}
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{items.length} sản phẩm tìm được</p>
            <button onClick={toggleAll} className="text-xs text-primary font-medium">
              {selected.size === items.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          </div>

          {items.map(item => (
            <div key={item.id} onClick={() => toggle(item.id)}
              className={`rounded-xl border bg-card shadow-sm p-3 flex items-start gap-3 cursor-pointer transition-colors ${selected.has(item.id) ? "border-primary bg-primary/5" : ""}`}>
              <div className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${selected.has(item.id) ? "bg-primary border-primary" : "border-gray-300"}`}>
                {selected.has(item.id) && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="h-12 w-12 rounded object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</p>
                {item.price && <p className="text-xs text-primary font-semibold">{item.price}</p>}
              </div>
            </div>
          ))}

          {selected.size > 0 && (
            <button onClick={generate} disabled={generating}
              className="w-full rounded-xl bg-primary py-3 text-sm text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 sticky bottom-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI viết bài cho {selected.size} sản phẩm đã chọn
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DraftsTab() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [primarySite, setPrimarySite] = useState<Site | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [selectedCat, setSelectedCat] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    const [data, sites]: [Draft[], Site[]] = await Promise.all([
      fetch(apiUrl("/api/admin/webscraper/drafts")).then(r => r.json()).catch(() => []),
      fetch(apiUrl("/api/admin/webscraper/sites")).then(r => r.json()).catch(() => []),
    ]);
    setDrafts(data);
    setPrimarySite(sites.find(s => s.role === "primary") ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function publish(draft: Draft) {
    const cat = selectedCat[draft.id] || draft.targetCategory;
    setPublishingId(draft.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/webscraper/drafts/${draft.id}/publish`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCategory: cat, siteId: primarySite?.id }),
      }).then(r => r.json());
      setResult(r => ({ ...r, [draft.id]: res.publishedUrl ? `✅ Đã đăng: ${res.publishedUrl}` : "✅ Đã đăng thành công!" }));
      await load();
    } catch { setResult(r => ({ ...r, [draft.id]: "❌ Có lỗi xảy ra" })); }
    setPublishingId(null);
  }

  async function deleteDraft(id: number) {
    if (!confirm("Xóa bài này?")) return;
    await fetch(apiUrl(`/api/admin/webscraper/drafts/${id}`), { method: "DELETE" }).catch(() => {});
    await load();
  }

  const categories = (primarySite?.categories as Array<{ name: string }>) ?? [];

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  if (drafts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>Chưa có bài chờ duyệt</p>
        <p className="text-xs mt-1">Tạo sản phẩm từ Tab 1 hoặc 2</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {drafts.map(draft => (
        <div key={draft.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 p-3.5 cursor-pointer" onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}>
            <div className="mt-0.5 shrink-0">
              {draft.status === "published" ? <CheckCircle className="h-4 w-4 text-green-500" /> :
               draft.status === "approved" ? <CheckCircle className="h-4 w-4 text-blue-500" /> :
               <Clock className="h-4 w-4 text-amber-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2 leading-snug">{draft.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(draft.createdAt).toLocaleDateString("vi-VN")} ·{" "}
                <span className={draft.status === "published" ? "text-green-600" : draft.status === "approved" ? "text-blue-600" : "text-amber-600"}>
                  {draft.status === "published" ? "Đã đăng" : draft.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}
                </span>
              </p>
            </div>
            <button onClick={e => { e.stopPropagation(); deleteDraft(draft.id); }} className="shrink-0 text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {expandedId === draft.id && (
            <div className="border-t p-3.5 space-y-3 bg-muted/30">
              <div className="max-h-40 overflow-y-auto rounded-lg bg-white border p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {draft.content}
              </div>
              {draft.publishedUrl && (
                <a href={draft.publishedUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />Xem bài đã đăng
                </a>
              )}
              {draft.status !== "published" && (
                <div className="space-y-2">
                  {categories.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Đăng vào danh mục:</label>
                      <select value={selectedCat[draft.id] ?? draft.targetCategory ?? ""}
                        onChange={e => setSelectedCat(s => ({ ...s, [draft.id]: e.target.value }))}
                        className="w-full mt-1 rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  {result[draft.id] && <p className="text-xs bg-muted rounded px-2.5 py-1.5">{result[draft.id]}</p>}
                  <button onClick={() => publish(draft)} disabled={publishingId === draft.id}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
                    {publishingId === draft.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Duyệt & Đăng lên web
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

function CatalogTab() {
  const { site, loading: siteLoading } = usePrimarySite();
  const [categories, setCategories] = useState<Array<{ name: string; url?: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string; template: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [editTemplateId, setEditTemplateId] = useState<number | null>(null);
  const [editTemplateContent, setEditTemplateContent] = useState("");

  useEffect(() => {
    if (!site) return;
    setCategories((site.categories as Array<{ name: string; url?: string }>) ?? []);
    fetch(apiUrl(`/api/admin/webscraper/sites/${site.id}/template`))
      .then(r => r.json()).then(t => { if (t) setTemplates([t]); }).catch(() => {});
  }, [site]);

  async function saveCategories() {
    if (!site) return;
    setSaving(true);
    await fetch(apiUrl(`/api/admin/webscraper/sites/${site.id}/categories`), {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories }),
    }).catch(() => {});
    setSaving(false);
  }

  function addCat() {
    if (!newCat.trim()) return;
    setCategories(c => [...c, { name: newCat.trim() }]);
    setNewCat("");
  }

  function removeCat(i: number) { setCategories(c => c.filter((_, idx) => idx !== i)); }

  async function saveTemplate(id: number, content: string) {
    await fetch(apiUrl(`/api/admin/webscraper/sites/${site!.id}/template`), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: site!.id }),
    }).catch(() => {});
    setTemplates(t => t.map(tmpl => tmpl.id === id ? { ...tmpl, template: content } : tmpl));
    setEditTemplateId(null);
  }

  if (siteLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  if (!site) return (
    <div className="text-center py-16 text-muted-foreground text-sm">
      <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p>Chưa có web bán hàng</p>
      <p className="text-xs mt-1">Vào Tab 1 để thêm web trước</p>
    </div>
  );

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Danh mục / Menu</h2>
          <button onClick={saveCategories} disabled={saving}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? "Đang lưu..." : "Lưu danh mục"}
          </button>
        </div>
        <div className="flex gap-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()}
            placeholder="Tên danh mục mới..."
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={addCat} className="px-3 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Chưa có danh mục — sẽ được lấy tự động khi phân tích web</p>
        ) : (
          <div className="space-y-1.5">
            {categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <span className="flex-1 text-sm">{cat.name}</span>
                {cat.url && <a href={cat.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
                <button onClick={() => removeCat(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {templates.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm">Biểu mẫu AI</h2>
          {templates.map(tmpl => (
            <div key={tmpl.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="font-medium text-sm">{tmpl.name}</p>
                <button onClick={() => { setEditTemplateId(tmpl.id); setEditTemplateContent(tmpl.template); }}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Edit3 className="h-3.5 w-3.5" />Sửa
                </button>
              </div>
              {editTemplateId === tmpl.id ? (
                <div className="p-3 space-y-2">
                  <textarea value={editTemplateContent} onChange={e => setEditTemplateContent(e.target.value)} rows={8}
                    className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 font-mono resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => saveTemplate(tmpl.id, editTemplateContent)}
                      className="flex-1 rounded-lg bg-primary py-2 text-xs text-white font-medium hover:bg-primary/90 transition-colors">Lưu</button>
                    <button onClick={() => setEditTemplateId(null)}
                      className="flex-1 rounded-lg border py-2 text-xs hover:bg-muted transition-colors">Hủy</button>
                  </div>
                </div>
              ) : (
                <p className="px-4 py-3 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{tmpl.template}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      )}
    </div>
  );
}
