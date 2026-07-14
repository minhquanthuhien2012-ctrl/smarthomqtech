import { useState, useEffect } from "react";
import {
  Cpu, Plus, Trash2, CheckCircle2, XCircle, Loader2, RefreshCw,
  Star, StarOff, TestTube2, Key, ChevronDown, ChevronRight, Search, X
} from "lucide-react";
import { apiBase } from "@/lib/api";

interface ModelConfig {
  id: number;
  provider: string;
  modelId: string;
  label: string;
  apiKey: string;
  baseUrl: string;
  isActive: boolean;
  isDefault: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
}

interface CatalogModel {
  provider: string;
  modelId: string;
  label: string;
  baseUrl: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-amber-100 text-amber-800",
  openai: "bg-emerald-100 text-emerald-800",
  gemini: "bg-blue-100 text-blue-800",
  groq: "bg-violet-100 text-violet-800",
  mistral: "bg-orange-100 text-orange-800",
  deepseek: "bg-cyan-100 text-cyan-800",
  xai: "bg-gray-100 text-gray-800",
  cohere: "bg-pink-100 text-pink-800",
  perplexity: "bg-indigo-100 text-indigo-800",
  together: "bg-rose-100 text-rose-800",
  ollama: "bg-teal-100 text-teal-800",
};

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "🤖", openai: "🧠", gemini: "✨", groq: "⚡", mistral: "🌊",
  deepseek: "🔮", xai: "🚀", cohere: "💎", perplexity: "🔍", together: "🤝", ollama: "🦙",
};

export default function AiModelsPage() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; response: string }>>({});
  const [editKeys, setEditKeys] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const [cfgs, cat] = await Promise.all([
      fetch(`${apiBase()}/admin/ai-models`).then(r => r.json()).catch(() => []) as Promise<ModelConfig[]>,
      fetch(`${apiBase()}/admin/ai-models/catalog`).then(r => r.json()).catch(() => []) as Promise<CatalogModel[]>,
    ]);
    setConfigs(cfgs);
    setCatalog(cat);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const providers = ["all", ...Array.from(new Set(catalog.map(m => m.provider)))];

  const filteredCatalog = catalog.filter(m => {
    const matchSearch = search === "" || m.label.toLowerCase().includes(search.toLowerCase()) || m.modelId.toLowerCase().includes(search.toLowerCase());
    const matchProvider = selectedProvider === "all" || m.provider === selectedProvider;
    return matchSearch && matchProvider;
  });

  const groupedCatalog = filteredCatalog.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, CatalogModel[]>);

  async function testKey(modelId: string, provider: string, apiKey: string, baseUrl: string) {
    setTesting(modelId);
    const res = await fetch(`${apiBase()}/admin/ai-models/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, modelId, apiKey, baseUrl }),
    }).then(r => r.json()).catch(() => ({ ok: false, response: "Network error" })) as { ok: boolean; response: string };
    setTestResults(prev => ({ ...prev, [modelId]: res }));
    setTesting(null);
  }

  async function saveModel(model: CatalogModel, apiKey: string) {
    setSavingKey(model.modelId);
    await fetch(`${apiBase()}/admin/ai-models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...model, apiKey, isActive: true }),
    });
    await load();
    setSavingKey(null);
  }

  async function setDefault(id: number) {
    await fetch(`${apiBase()}/admin/ai-models/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await load();
  }

  async function deleteModel(id: number) {
    if (!confirm("Xoá cấu hình model này?")) return;
    await fetch(`${apiBase()}/admin/ai-models/${id}`, { method: "DELETE" });
    await load();
  }

  function toggleExpand(provider: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(provider) ? n.delete(provider) : n.add(provider);
      return n;
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Cpu className="h-5 w-5 text-primary" />Quản lý AI Model</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Thêm API Key cho các AI model — MCP Server sẽ dùng model mặc định</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />{showAdd ? "Ẩn danh sách" : "Thêm Model"}
        </button>
      </div>

      {/* Active model configs */}
      {configs.length > 0 && (
        <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <p className="font-semibold text-sm flex items-center gap-2"><Key className="h-4 w-4" />Model đã cấu hình ({configs.length})</p>
            <button onClick={load} className="text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          <div className="divide-y">
            {configs.map(cfg => {
              const testR = testResults[cfg.modelId];
              return (
                <div key={cfg.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <span className="text-xl shrink-0">{PROVIDER_ICONS[cfg.provider] ?? "🤖"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{cfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROVIDER_COLORS[cfg.provider] ?? "bg-gray-100 text-gray-700"}`}>{cfg.provider}</span>
                      {cfg.isDefault && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium flex items-center gap-0.5"><Star className="h-3 w-3" />Mặc định</span>}
                      {cfg.lastTestOk === true && <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 className="h-3.5 w-3.5" />OK</span>}
                      {cfg.lastTestOk === false && <span className="text-xs text-red-500 flex items-center gap-0.5"><XCircle className="h-3.5 w-3.5" />Lỗi</span>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{cfg.modelId}</p>
                    {testR && (
                      <p className={`text-xs mt-1 ${testR.ok ? "text-green-600" : "text-red-500"}`}>
                        {testR.ok ? "✅" : "❌"} {testR.response}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => void testKey(cfg.modelId, cfg.provider, cfg.apiKey, cfg.baseUrl)}
                      disabled={testing === cfg.modelId}
                      className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors">
                      {testing === cfg.modelId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}Test
                    </button>
                    {!cfg.isDefault && (
                      <button onClick={() => void setDefault(cfg.id)}
                        className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-yellow-50 hover:text-yellow-700 transition-colors">
                        <StarOff className="h-3.5 w-3.5" />Mặc định
                      </button>
                    )}
                    <button onClick={() => void deleteModel(cfg.id)} className="text-muted-foreground hover:text-destructive p-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Catalog */}
      {showAdd && (
        <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="font-semibold text-sm mb-3">Danh sách AI Model</p>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm model..."
                  className="w-full rounded-lg border pl-8 pr-8 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
                {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="flex gap-1 flex-wrap">
                {providers.map(p => (
                  <button key={p} onClick={() => setSelectedProvider(p)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${selectedProvider === p ? "bg-primary text-white" : "border hover:bg-muted"}`}>
                    {p === "all" ? "Tất cả" : `${PROVIDER_ICONS[p] ?? ""} ${p}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedCatalog).map(([provider, models]) => (
              <div key={provider}>
                <button onClick={() => toggleExpand(provider)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <span className="text-xl">{PROVIDER_ICONS[provider] ?? "🤖"}</span>
                  <span className="font-semibold text-sm capitalize flex-1 text-left">{provider}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PROVIDER_COLORS[provider] ?? "bg-gray-100 text-gray-700"}`}>{models.length} model</span>
                  {expanded.has(provider) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {expanded.has(provider) && (
                  <div className="bg-muted/10 border-t divide-y">
                    {models.map(model => {
                      const configured = configs.find(c => c.modelId === model.modelId);
                      const key = editKeys[model.modelId] ?? (configured?.apiKey ?? "");
                      const testR = testResults[model.modelId];

                      return (
                        <div key={model.modelId} className="px-4 py-3 space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{model.label}</span>
                                {configured && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Đã thêm</span>}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{model.modelId}</p>
                            </div>
                          </div>

                          {provider !== "ollama" && (
                            <div className="flex gap-2 items-center">
                              <div className="relative flex-1">
                                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <input
                                  value={key}
                                  onChange={e => setEditKeys(prev => ({ ...prev, [model.modelId]: e.target.value }))}
                                  type="password"
                                  placeholder="Nhập API Key..."
                                  className="w-full rounded-lg border pl-7 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
                              </div>
                              <button
                                onClick={() => key && void testKey(model.modelId, provider, key, model.baseUrl)}
                                disabled={!key || testing === model.modelId}
                                className="shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors">
                                {testing === model.modelId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}Test
                              </button>
                              <button
                                onClick={() => key && void saveModel(model, key)}
                                disabled={!key || savingKey === model.modelId}
                                className="shrink-0 flex items-center gap-1 rounded-lg bg-primary px-2.5 py-2 text-xs text-white disabled:opacity-40 hover:bg-primary/90 transition-colors">
                                {savingKey === model.modelId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Lưu
                              </button>
                            </div>
                          )}

                          {provider === "ollama" && (
                            <button onClick={() => void saveModel(model, "ollama")}
                              disabled={savingKey === model.modelId}
                              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors">
                              {savingKey === model.modelId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                              Thêm (Ollama local)
                            </button>
                          )}

                          {testR && (
                            <div className={`rounded-lg px-3 py-2 text-xs ${testR.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                              {testR.ok ? "✅ Kết nối thành công:" : "❌ Lỗi:"} {testR.response}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!showAdd && configs.length === 0 && !loading && (
        <div className="text-center py-16 border rounded-2xl text-muted-foreground space-y-3">
          <div className="text-4xl">🤖</div>
          <p className="font-medium">Chưa có AI model nào được cấu hình</p>
          <p className="text-xs max-w-xs mx-auto">Nhấn "Thêm Model" để chọn provider (Gemini, GPT, Claude, Groq...) và nhập API Key</p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />Thêm Model đầu tiên
          </button>
        </div>
      )}
    </div>
  );
}
