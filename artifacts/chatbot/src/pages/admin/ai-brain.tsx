import { useState, useEffect, useCallback } from "react";
import {
  Brain, Loader2, RefreshCw, Plus, Trash2, Zap, ToggleLeft, ToggleRight,
  Cpu, Settings2, Archive, Search, X, ChevronDown, ChevronUp, FlaskConical,
  AlertCircle, Clock
} from "lucide-react";
import { apiBase } from "@/lib/api";

interface BrainConfig {
  id: number;
  chatbotId: number | null;
  isAutoEnabled: boolean;
  scanIntervalMinutes: number;
  maxMemories: number;
  compressionThreshold: number;
  autoLearn: boolean;
  autoSuggest: boolean;
  autoAsk: boolean;
  lastScanAt: string | null;
  nextScanAt: string | null;
}

interface Memory {
  id: number;
  chatbotId: number | null;
  category: string;
  content: string;
  importance: number;
  source: string;
  isCompressed: boolean;
  tags: string[];
  createdAt: string;
}

const CATEGORIES = ["general", "habit", "preference", "tool_usage", "skill_usage", "user_info", "product", "conversation", "system"];
const CATEGORY_LABELS: Record<string, string> = {
  general: "Tổng quát", habit: "Thói quen", preference: "Sở thích",
  tool_usage: "Dùng Tool", skill_usage: "Dùng Skill", user_info: "Info User",
  product: "Sản phẩm", conversation: "Hội thoại", system: "Hệ thống",
};
const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700", habit: "bg-amber-100 text-amber-700",
  preference: "bg-blue-100 text-blue-700", tool_usage: "bg-violet-100 text-violet-700",
  skill_usage: "bg-emerald-100 text-emerald-700", user_info: "bg-pink-100 text-pink-700",
  product: "bg-orange-100 text-orange-700", conversation: "bg-cyan-100 text-cyan-700",
  system: "bg-red-100 text-red-700",
};

const DEFAULT_CHATBOT_ID = 1;

export default function AiBrainPage() {
  const [config, setConfig] = useState<BrainConfig | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [scanResult, setScanResult] = useState<{ memoryCount: number; suggestions: string[] } | null>(null);
  const [newMem, setNewMem] = useState({ content: "", category: "general", importance: 0.7, tags: "" });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cfg, mems] = await Promise.all([
      fetch(`${apiBase()}/admin/ai-brain/config/${DEFAULT_CHATBOT_ID}`).then(r => r.json()).catch(() => null) as Promise<BrainConfig | null>,
      fetch(`${apiBase()}/admin/ai-brain/memories?chatbotId=${DEFAULT_CHATBOT_ID}&limit=200`).then(r => r.json()).catch(() => ({ memories: [], total: 0 })) as Promise<{ memories: Memory[]; total: number }>,
    ]);
    setConfig(cfg);
    setMemories(mems.memories ?? []);
    setTotal(mems.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function saveConfig(patch: Partial<BrainConfig>) {
    if (!config) return;
    setSaving(true);
    const res = await fetch(`${apiBase()}/admin/ai-brain/config/${DEFAULT_CHATBOT_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(r => r.json()).catch(() => null) as BrainConfig | null;
    if (res) setConfig(res);
    setSaving(false);
  }

  async function toggleAuto() {
    if (!config) return;
    await saveConfig({ isAutoEnabled: !config.isAutoEnabled });
  }

  async function runScan() {
    setScanning(true);
    const res = await fetch(`${apiBase()}/admin/ai-brain/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId: DEFAULT_CHATBOT_ID }),
    }).then(r => r.json()).catch(() => null) as {
      ok: boolean; memoryCount: number; suggestions: string[];
    } | null;
    if (res) setScanResult({ memoryCount: res.memoryCount, suggestions: res.suggestions });
    setScanning(false);
    await loadAll();
  }

  async function compressMemories() {
    if (!confirm("AI sẽ nén và tổng hợp bộ nhớ cũ. Tiếp tục?")) return;
    setCompressing(true);
    await fetch(`${apiBase()}/admin/ai-brain/compress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId: DEFAULT_CHATBOT_ID }),
    }).then(r => r.json()).catch(() => null);
    setCompressing(false);
    await loadAll();
  }

  async function addMemory() {
    if (!newMem.content.trim()) return;
    await fetch(`${apiBase()}/admin/ai-brain/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatbotId: DEFAULT_CHATBOT_ID,
        content: newMem.content,
        category: newMem.category,
        importance: newMem.importance,
        source: "manual",
        tags: newMem.tags.split(",").map(t => t.trim()).filter(Boolean),
      }),
    });
    setNewMem({ content: "", category: "general", importance: 0.7, tags: "" });
    setShowAdd(false);
    await loadAll();
  }

  async function deleteMemory(id: number) {
    await fetch(`${apiBase()}/admin/ai-brain/memories/${id}`, { method: "DELETE" });
    setMemories(prev => prev.filter(m => m.id !== id));
    setTotal(t => t - 1);
  }

  const filtered = memories.filter(m => {
    const matchSearch = !search || m.content.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || m.category === filterCat;
    return matchSearch && matchCat;
  });

  const usagePercent = config ? Math.min(100, Math.round(total / config.maxMemories * 100)) : 0;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Bộ não AI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bộ nhớ dài hạn, tự học, tự đề xuất của AI Agent</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors">
            <Settings2 className="h-3.5 w-3.5" />Cấu hình
          </button>
          <button onClick={() => void runScan()} disabled={scanning}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors">
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}Quét ngay
          </button>
          <button onClick={() => void compressMemories()} disabled={compressing}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors">
            {compressing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}Nén bộ nhớ
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" />Thêm ký ức
          </button>
        </div>
      </div>

      {/* AUTO Toggle + Stats */}
      {config && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card shadow-sm p-4 flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${config.isAutoEnabled ? "bg-green-100" : "bg-gray-100"}`}>
              <Cpu className={`h-7 w-7 ${config.isAutoEnabled ? "text-green-600" : "text-gray-400"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Chế độ AUTO</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config.isAutoEnabled ? `Đang chạy — quét mỗi ${config.scanIntervalMinutes} phút` : "Tắt — bật để AI tự học 100%"}
              </p>
            </div>
            <button onClick={() => void toggleAuto()} disabled={saving}
              className={`shrink-0 transition-colors ${config.isAutoEnabled ? "text-green-500 hover:text-green-600" : "text-gray-300 hover:text-gray-400"}`}>
              {config.isAutoEnabled ? <ToggleRight className="h-10 w-10" /> : <ToggleLeft className="h-10 w-10" />}
            </button>
          </div>

          <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Bộ nhớ</p>
              <span className={`text-xs font-medium ${usagePercent > 80 ? "text-red-500" : usagePercent > 60 ? "text-amber-500" : "text-green-600"}`}>
                {total} / {config.maxMemories}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${usagePercent > 80 ? "bg-red-500" : usagePercent > 60 ? "bg-amber-500" : "bg-green-500"}`}
                style={{ width: `${usagePercent}%` }} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {config.lastScanAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Quét: {new Date(config.lastScanAt).toLocaleString("vi-VN")}</span>}
              {config.nextScanAt && config.isAutoEnabled && <span>Tiếp: {new Date(config.nextScanAt).toLocaleString("vi-VN")}</span>}
            </div>
            {usagePercent > 80 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />Gần đầy — nên nén bộ nhớ
              </div>
            )}
          </div>
        </div>
      )}

      {/* Config panel */}
      {showConfig && config && (
        <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-4">
          <p className="font-semibold text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" />Cấu hình Bộ não AI</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Quét định kỳ (phút)</label>
              <input type="number" min={5} max={1440} value={config.scanIntervalMinutes}
                onChange={e => setConfig(c => c ? { ...c, scanIntervalMinutes: Number(e.target.value) } : c)}
                onBlur={() => void saveConfig({ scanIntervalMinutes: config.scanIntervalMinutes })}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Giới hạn bộ nhớ</label>
              <input type="number" min={50} max={5000} value={config.maxMemories}
                onChange={e => setConfig(c => c ? { ...c, maxMemories: Number(e.target.value) } : c)}
                onBlur={() => void saveConfig({ maxMemories: config.maxMemories })}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nén khi đạt (entries)</label>
              <input type="number" min={20} max={4000} value={config.compressionThreshold}
                onChange={e => setConfig(c => c ? { ...c, compressionThreshold: Number(e.target.value) } : c)}
                onBlur={() => void saveConfig({ compressionThreshold: config.compressionThreshold })}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "autoLearn", label: "Tự học" },
              { key: "autoSuggest", label: "Tự đề xuất" },
              { key: "autoAsk", label: "Tự hỏi user" },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => void saveConfig({ [key]: !config[key] })}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${config[key] ? "bg-primary/5 border-primary/30 text-primary" : "hover:bg-muted"}`}>
                <span>{label}</span>
                {config[key] ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5 text-gray-300" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scan result */}
      {scanResult && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-blue-700 flex items-center gap-2"><Zap className="h-4 w-4" />Kết quả quét</p>
            <button onClick={() => setScanResult(null)} className="text-blue-400 hover:text-blue-600"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-blue-700">Tổng bộ nhớ: {scanResult.memoryCount} entries</p>
          {scanResult.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-blue-600 flex items-start gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{s}</p>
          ))}
        </div>
      )}

      {/* Add memory */}
      {showAdd && (
        <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-3">
          <p className="font-semibold text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Thêm ký ức thủ công</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <textarea value={newMem.content} onChange={e => setNewMem(p => ({ ...p, content: e.target.value }))}
                rows={3} placeholder="Nội dung ký ức..."
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Danh mục</label>
              <select value={newMem.category} onChange={e => setNewMem(p => ({ ...p, category: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Độ quan trọng: {newMem.importance.toFixed(1)}</label>
              <input type="range" min="0" max="1" step="0.1" value={newMem.importance}
                onChange={e => setNewMem(p => ({ ...p, importance: Number(e.target.value) }))}
                className="w-full" />
            </div>
            <div className="col-span-2">
              <input value={newMem.tags} onChange={e => setNewMem(p => ({ ...p, tags: e.target.value }))}
                placeholder="Tags (phân cách bằng dấu phẩy)"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void addMemory()}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
              Lưu ký ức
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-xl border px-4 py-2.5 text-sm hover:bg-muted transition-colors">Huỷ</button>
          </div>
        </div>
      )}

      {/* Memory list */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm flex items-center gap-2"><Brain className="h-4 w-4" />Bộ nhớ ({total})</p>
            <button onClick={loadAll} className="text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-36">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm ký ức..."
                className="w-full rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setFilterCat("all")}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${filterCat === "all" ? "bg-primary text-white" : "border hover:bg-muted"}`}>Tất cả</button>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${filterCat === c ? "bg-primary text-white" : "border hover:bg-muted"}`}>
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {memories.length === 0 ? "Chưa có ký ức nào — bắt đầu chat để AI tự học!" : "Không tìm thấy ký ức phù hợp"}
          </div>
        ) : (
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {filtered.map(mem => (
              <MemoryRow key={mem.id} memory={mem} onDelete={deleteMemory} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryRow({ memory, onDelete }: { memory: Memory; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = memory.content.length > 120;

  return (
    <div className="px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[memory.category] ?? "bg-gray-100 text-gray-700"}`}>
              {CATEGORY_LABELS[memory.category] ?? memory.category}
            </span>
            <span className="text-xs text-muted-foreground">
              imp: {memory.importance.toFixed(1)}
            </span>
            {memory.isCompressed && <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">nén</span>}
            <span className="text-xs text-muted-foreground">{memory.source}</span>
          </div>
          <p className={`text-sm leading-relaxed ${!expanded && isLong ? "line-clamp-2" : ""}`}>{memory.content}</p>
          {isLong && (
            <button onClick={() => setExpanded(v => !v)} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              {expanded ? <><ChevronUp className="h-3 w-3" />Thu gọn</> : <><ChevronDown className="h-3 w-3" />Xem thêm</>}
            </button>
          )}
          {(memory.tags as string[]).length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {(memory.tags as string[]).map(t => (
                <span key={t} className="text-xs bg-muted px-1.5 py-0.5 rounded-full">#{t}</span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{new Date(memory.createdAt).toLocaleString("vi-VN")}</p>
        </div>
        <button onClick={() => onDelete(memory.id)} className="text-muted-foreground hover:text-destructive p-1 shrink-0 mt-0.5">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
