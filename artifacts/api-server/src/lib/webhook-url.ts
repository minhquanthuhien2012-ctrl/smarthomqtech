export function getWebhookBaseUrl() {
  const productionUrl = process.env["PRODUCTION_URL"]?.trim().replace(/\/+$/, "");
  if (productionUrl) return productionUrl;

  const primaryDomain = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
  return primaryDomain ? `https://${primaryDomain}` : "";
}