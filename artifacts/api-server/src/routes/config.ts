import { Router } from "express";

const router = Router();

router.get("/config", (_req, res) => {
  const domains = process.env["REPLIT_DOMAINS"] ?? "";
  const primaryDomain = domains.split(",")[0]?.trim() ?? "";
  const webhookBase = primaryDomain
    ? `https://${primaryDomain}`
    : "http://localhost";

  res.json({
    webhookBase,
    webhooks: {
      zalo: `${webhookBase}/api/webhooks/zalo`,
      messenger: `${webhookBase}/api/webhooks/messenger`,
    },
  });
});

export default router;
