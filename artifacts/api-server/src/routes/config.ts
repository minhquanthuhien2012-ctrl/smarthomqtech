import { Router } from "express";
import { getWebhookBaseUrl } from "../lib/webhook-url.js";

const router = Router();

router.get("/config", (_req, res) => {
  // PRODUCTION_URL is set manually and takes priority
  const webhookBase = getWebhookBaseUrl() || "http://localhost";

  res.json({
    webhookBase,
    webhooks: {
      zalo: `${webhookBase}/api/webhooks/zalo`,
      messenger: `${webhookBase}/api/webhooks/messenger`,
    },
  });
});

export default router;
