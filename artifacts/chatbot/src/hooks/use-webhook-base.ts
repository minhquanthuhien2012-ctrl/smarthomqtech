import { useState, useEffect } from "react";
import { apiBase } from "@/lib/api";

let cached: string | null = null;

export function useWebhookBase() {
  const [webhookBase, setWebhookBase] = useState<string>(cached ?? "");

  useEffect(() => {
    if (cached) { setWebhookBase(cached); return; }
    fetch(`${apiBase()}/config`)
      .then(r => r.json())
      .then((data: { webhookBase: string }) => {
        cached = data.webhookBase;
        setWebhookBase(data.webhookBase);
      })
      .catch(() => {
        const fallback = typeof window !== "undefined" ? window.location.origin : "";
        cached = fallback;
        setWebhookBase(fallback);
      });
  }, []);

  return webhookBase;
}
