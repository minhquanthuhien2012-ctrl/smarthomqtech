export function apiBase() {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
}

export async function safeFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, options);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json() as T;
  } catch (err) {
    console.error("[safeFetch]", url, err);
    return null;
  }
}
