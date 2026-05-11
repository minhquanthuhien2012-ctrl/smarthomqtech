import { Router } from "express";

const router = Router();

router.get("/config", (_req, res) => {
  // PRODUCTION_URL is set manually and takes priority
  const productionUrl = process.env["PRODUCTION_URL"] ?? "";

  // Fallback: use REPLIT_DOMAINS (correct in production env)
  const domains = process.env["REPLIT_DOMAINS"] ?? "";
  const primaryDomain = domains.split(",")[0]?.trim() ?? "";
  const webhookBase = productionUrl || (primaryDomain ? `https://${primaryDomain}` : "http://localhost");

  res.json({
    webhookBase,
    webhooks: {
      zalo: `${webhookBase}/api/webhooks/zalo`,
      messenger: `${webhookBase}/api/webhooks/messenger`,
    },
  });
});

export default router;
