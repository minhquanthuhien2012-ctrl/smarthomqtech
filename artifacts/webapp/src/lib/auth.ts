const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${BASE}${path}`;
}

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string;
  role: string;
}

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string) {
  localStorage.setItem("auth_token", token);
}

export function clearToken() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) as AuthUser : null;
  } catch { return null; }
}

export function setUser(user: AuthUser) {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { clearToken(); return null; }
    const user = await res.json() as AuthUser;
    setUser(user);
    return user;
  } catch { return null; }
}
