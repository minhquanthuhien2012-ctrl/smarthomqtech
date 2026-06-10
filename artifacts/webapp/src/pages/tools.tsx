import { useState, useEffect } from "react";
import { Wrench, Zap, CheckCircle, Clock, XCircle, Settings, ChevronRight, Globe, Loader2, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string) { return `${BASE}${path}`; }

function getUserId(): string {
  let id = localStorage.getItem("user_identifier");
  if (!id) {
    id = "user_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now();
    localStorage.setItem("user_identifier", id);
  }
  return id;
}

interface Tool { id: number; name: string; description: string; isBuiltin: boolean; isActive: boolean; }
interface Skill { id: number; name: string; description: string; isActive: boolean; }
interface ToolRequest { id: number; toolName: string; requestType: "tool" | "skill"; status: "pending" | "approved" | "rejected"; }

const TOOL_ICONS: Record<string, string> = {
  "Quản lý Web Site": "🌐",
  "fetch_url": "🔗",
  "calculator": "🧮",
  "get_current_time": "🕐",
  "gdrive_read": "📂",
  "gdrive_list": "📋",
};

const TOOL_CONFIGS: Record<string, string> = {
  "Quản lý Web Site": "/webscraper",
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [myRequests, setMyRequests] = useState<ToolRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const userId = getUserId();

  async function load() {
    setLoading(true);
    try {
      const [toolsRes, skillsRes, reqsRes] = await Promise.all([
        fetch(apiUrl("/api/admin/tools")),
        fetch(apiUrl("/api/admin/skills")),
        fetch(apiUrl(`/api/admin/tool-requests/my?userIdentifier=${encodeURIComponent(userId)}`)),
      ]);
      setTools(await toolsRes.json());
      setSkills(await skillsRes.json());
      setMyRequests(await reqsRes.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getStatus(name: string, type: "tool" | "skill"): ToolRequest | undefined {
    return myRequests.find(r => r.toolName === name && r.requestType === type);
  }

  async function requestTool(name: string, type: "tool" | "skill") {
    const key = `${type}:${name}`;
    setActing(key);
    try {
      await fetch(apiUrl("/api/admin/tool-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIdentifier: userId, toolName: name, requestType: type }),
      });
      await load();
    } catch {}
    setActing(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">Tool & Skill</div>
          <div className="text-xs text-muted-foreground">Xin dùng và cấu hình</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {tools.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Tools ({tools.length})
            </h2>
            <div className="space-y-2">
              {tools.filter(t => t.isActive).map(tool => (
                <ToolCard
                  key={tool.id}
                  name={tool.name}
                  description={tool.description}
                  type="tool"
                  icon={TOOL_ICONS[tool.name] || "🔧"}
                  request={getStatus(tool.name, "tool")}
                  acting={acting === `tool:${tool.name}`}
                  configPath={TOOL_CONFIGS[tool.name]}
                  onRequest={() => requestTool(tool.name, "tool")}
                  onConfig={() => navigate(TOOL_CONFIGS[tool.name] ?? "/")}
                />
              ))}
            </div>
          </section>
        )}

        {skills.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Skills ({skills.length})
            </h2>
            <div className="space-y-2">
              {skills.filter(s => s.isActive).map(skill => (
                <ToolCard
                  key={skill.id}
                  name={skill.name}
                  description={skill.description}
                  type="skill"
                  icon="⚡"
                  request={getStatus(skill.name, "skill")}
                  acting={acting === `skill:${skill.name}`}
                  onRequest={() => requestTool(skill.name, "skill")}
                />
              ))}
            </div>
          </section>
        )}

        {tools.length === 0 && skills.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Chưa có tool/skill nào</p>
            <p className="text-xs mt-1">Admin cần tạo tool trước</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({ name, description, type, icon, request, acting, configPath, onRequest, onConfig }: {
  name: string;
  description: string;
  type: "tool" | "skill";
  icon: string;
  request?: ToolRequest;
  acting: boolean;
  configPath?: string;
  onRequest: () => void;
  onConfig?: () => void;
}) {
  const isApproved = request?.status === "approved";
  const isPending = request?.status === "pending";
  const isRejected = request?.status === "rejected";

  return (
    <div className={`rounded-xl border bg-card shadow-sm overflow-hidden ${isApproved ? "border-green-200" : ""}`}>
      <div className="flex items-start gap-3 p-3.5">
        <div className={`text-2xl shrink-0 mt-0.5`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              type === "tool" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
            }`}>{type}</span>
            {isApproved && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" />Đã duyệt</span>}
            {isPending && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1"><Clock className="h-3 w-3" />Chờ duyệt</span>}
            {isRejected && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1"><XCircle className="h-3 w-3" />Từ chối</span>}
          </div>
          {description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {!request && (
            <button onClick={onRequest} disabled={acting}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Xin dùng"}
            </button>
          )}
          {isApproved && configPath && (
            <button onClick={onConfig}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors">
              <Globe className="h-3.5 w-3.5" />
              Cấu hình
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
          {isRejected && (
            <button onClick={onRequest} disabled={acting}
              className="text-xs px-2.5 py-1.5 rounded-lg border text-muted-foreground hover:bg-muted transition-colors">
              Xin lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
