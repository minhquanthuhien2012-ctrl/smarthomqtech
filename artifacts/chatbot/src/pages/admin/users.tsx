import { useState, useEffect } from "react";
import { Users, Search, RefreshCw, Eye, Lock, Unlock, Loader2, X, ChevronDown, ChevronUp, MessageSquare, Wrench, Zap } from "lucide-react";
import { apiBase } from "@/lib/api";

interface User {
  id: number;
  email: string;
  displayName: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UserDetail {
  user: User;
  chatbot: { aiName: string; systemPrompt: string; model: string } | null;
  connections: Array<{ id: number; type: string; name: string; status: string }>;
  toolRequests: Array<{ id: number; toolName: string; requestType: string; status: string }>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const data = await fetch(`${apiBase()}/admin/users`).then(r => r.json()).catch(() => []) as User[];
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    const data = await fetch(`${apiBase()}/admin/users/${id}`).then(r => r.json()).catch(() => null) as UserDetail | null;
    setDetail(data);
    setDetailLoading(false);
  }

  async function toggleActive(user: User) {
    setActing(user.id);
    await fetch(`${apiBase()}/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    await load();
    setActing(null);
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    await loadDetail(id);
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    locked: users.filter(u => !u.isActive).length,
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5" />Quản lý Khách hàng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Danh sách tài khoản người dùng trên App</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" />Tải lại
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Tổng cộng", value: stats.total, color: "bg-blue-50 text-blue-700" },
          { label: "Đang hoạt động", value: stats.active, color: "bg-green-50 text-green-700" },
          { label: "Đã khoá", value: stats.locked, color: "bg-red-50 text-red-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl ${s.color} px-4 py-3 text-center`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo email hoặc tên..."
          className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-card" />
        {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border rounded-xl">
          {users.length === 0 ? "Chưa có user nào đăng ký" : "Không tìm thấy user"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => (
            <div key={user.id} className={`rounded-xl border bg-card shadow-sm overflow-hidden ${!user.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 p-3.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${user.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {(user.displayName || user.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{user.displayName || "(chưa đặt tên)"}</span>
                    {user.role === "admin" && <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Admin</span>}
                    {!user.isActive && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Đã khoá</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString("vi-VN")}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleActive(user)} disabled={acting === user.id}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      user.isActive ? "text-red-500 border-red-200 hover:bg-red-50" : "text-green-600 border-green-200 hover:bg-green-50"
                    }`}>
                    {acting === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                      user.isActive ? <><Lock className="h-3.5 w-3.5" />Khoá</> : <><Unlock className="h-3.5 w-3.5" />Mở</>}
                  </button>
                  <button onClick={() => toggleExpand(user.id)}
                    className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
                    <Eye className="h-3.5 w-3.5" />
                    {expandedId === user.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {expandedId === user.id && (
                <div className="border-t bg-muted/20 p-3.5 space-y-3">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                  ) : detail && (
                    <>
                      {detail.chatbot && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />AI Cá nhân
                          </p>
                          <div className="rounded-lg border bg-white p-3 text-xs space-y-1">
                            <p><span className="font-medium">Tên:</span> {detail.chatbot.aiName}</p>
                            <p><span className="font-medium">Model:</span> {detail.chatbot.model}</p>
                            {detail.chatbot.systemPrompt && (
                              <p className="text-muted-foreground line-clamp-2">{detail.chatbot.systemPrompt}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {detail.connections.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kết nối Bot</p>
                          <div className="space-y-1">
                            {detail.connections.map(c => (
                              <div key={c.id} className="rounded-lg border bg-white px-3 py-2 text-xs flex items-center justify-between">
                                <span className="font-medium capitalize">{c.type} — {c.name}</span>
                                <span className={`px-1.5 py-0.5 rounded-full ${c.status === "connected" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {detail.toolRequests.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Wrench className="h-3.5 w-3.5" />Yêu cầu Tool/Skill
                          </p>
                          <div className="space-y-1">
                            {detail.toolRequests.map(r => (
                              <div key={r.id} className="rounded-lg border bg-white px-3 py-2 text-xs flex items-center justify-between">
                                <span>{r.requestType === "tool" ? <Wrench className="inline h-3 w-3 mr-1" /> : <Zap className="inline h-3 w-3 mr-1" />}{r.toolName}</span>
                                <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                                  r.status === "approved" ? "bg-green-100 text-green-700" :
                                  r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                }`}>{r.status === "approved" ? "Đã duyệt" : r.status === "rejected" ? "Từ chối" : "Chờ duyệt"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!detail.chatbot && detail.connections.length === 0 && detail.toolRequests.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">User chưa cấu hình gì</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
