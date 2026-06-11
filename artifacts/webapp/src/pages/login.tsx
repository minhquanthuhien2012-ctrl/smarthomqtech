import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Mail, Lock, Eye, EyeOff, Bot } from "lucide-react";
import { apiUrl, setToken, setUser, type AuthUser } from "@/lib/auth";

interface Props { onLogin: (user: AuthUser) => void; }

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email, password };
      if (mode === "register") body.displayName = displayName;
      const res = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok) { setError(data.error || "Có lỗi xảy ra"); return; }
      setToken(data.token!);
      setUser(data.user!);
      onLogin(data.user!);
      navigate("/");
    } catch { setError("Không thể kết nối server"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
            <Bot className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">AI cá nhân</h1>
          <p className="text-sm text-muted-foreground">Trợ lý AI thông minh cho bạn</p>
        </div>

        <div className="flex rounded-xl border bg-muted/30 p-1">
          <button onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${mode === "login" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Đăng nhập
          </button>
          <button onClick={() => setMode("register")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${mode === "register" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Đăng ký
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <div className="relative">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Tên hiển thị (tuỳ chọn)"
                className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder="Email" required
              className="w-full rounded-xl border bg-card pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={password} onChange={e => setPassword(e.target.value)}
              type={showPw ? "text" : "password"} placeholder="Mật khẩu (tối thiểu 6 ký tự)" required minLength={6}
              className="w-full rounded-xl border bg-card pl-10 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">smarthomeq.tech</p>
      </div>
    </div>
  );
}
