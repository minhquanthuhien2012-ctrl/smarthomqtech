export function apiBase() {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
}
