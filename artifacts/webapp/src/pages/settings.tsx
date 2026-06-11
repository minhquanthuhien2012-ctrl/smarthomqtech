import { useState, useEffect } from "react";
import { Loader2, Bot, Save, LogOut, User, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { apiUrl, authHeaders, getUser, clearToken, type AuthUser } from "@/lib/auth";

interface UserChatbot {
  aiName: string;
  systemPrompt: string;
  model: string;
}

interface Props { user: AuthUser; onLogout: () => void; }

export default function SettingsPage({ user, onLogout }: Props) {
  const [chatbot, setChatbot] = useState<UserChatbot>({ aiName: "AI cá nhân", systemPrompt: "", model: "claude-sonnet-4-6" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch(apiUrl("/api/user/chatbot"), { headers: authHeaders() })
      .then(r => r.json()).then(d => { if (d.aiName) setChatbot(d); }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveChatbot() {
    setSaving(true);
    await fetch(apiUrl("/api/user/chatbot"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(chatbot),
    }).catch(() => {});
    if (displayName !== user.displayName) {
      await fetch(apiUrl("/api/user/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ displayName }),
      }).catch(() => {});
    }
    localStorage.setItem("ai_business_name", chatbot.aiName);
    window.dispatchEvent(new Event("ai_name_updated"));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function logout() {
    await fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
    clearToken();
    onLogout();
    navigate("/");
  }

  const models = [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet (Nhanh)" },
    { value: "claude-opus-4-5", label: "Claude Opus (Mạnh nhất)" },
    { value: "claude-haiku-3-5", label: "Claude Haiku (Tiết kiệm)" },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
          <User className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">Cài đặt</div>
          <div className="text-xs text-muted-foreground truncate max-w-48">{user.email}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Thông tin cá nhân</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tên hiển thị</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <input value={user.email} disabled
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-muted/30 text-muted-foreground" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Bot className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Cấu hình AI cá nhân</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tên AI của bạn</label>
                <input value={chatbot.aiName} onChange={e => setChatbot(c => ({ ...c, aiName: e.target.value }))}
                  placeholder="Ví dụ: AI nhân viên bán hàng SmartHomeQ"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Model AI</label>
                <select value={chatbot.model} onChange={e => setChatbot(c => ({ ...c, model: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                  {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Hướng dẫn cho AI (System Prompt)
                </label>
                <textarea value={chatbot.systemPrompt} onChange={e => setChatbot(c => ({ ...c, systemPrompt: e.target.value }))}
                  rows={5} placeholder="Ví dụ: Bạn là nhân viên tư vấn bán hàng của SmartHomeQ. Hãy tư vấn sản phẩm nhà thông minh cho khách hàng một cách chuyên nghiệp, thân thiện..."
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed" />
                <p className="text-xs text-muted-foreground mt-1">Mô tả cách AI sẽ trả lời, phong cách, lĩnh vực chuyên môn...</p>
              </div>

              {saved && (
                <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 font-medium">
                  ✅ Đã lưu thành công!
                </div>
              )}

              <button onClick={saveChatbot} disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary/90 transition-colors">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Đang lưu..." : "Lưu cài đặt"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <button onClick={() => navigate("/connections")}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
              <span className="text-lg">🔗</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Kết nối Bot</p>
                <p className="text-xs text-muted-foreground">Zalo, Telegram, Facebook, Xiaozhi</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </section>

          <button onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
