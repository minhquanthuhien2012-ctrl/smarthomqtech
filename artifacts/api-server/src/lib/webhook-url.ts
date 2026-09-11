export function getWebhookBaseUrl() {
  const devDomain = process.env["REPLIT_DEV_DOMAIN"]?.trim();
  if (process.env["NODE_ENV"] !== "production" && devDomain) {
    return `https://${devDomain}`.replace(/\/+$/, "");
  }

  const productionUrl = process.env["PRODUCTION_URL"]?.trim().replace(/\/+$/, "");
  if (productionUrl) return productionUrl;

  const primaryDomain = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
  return primaryDomain ? `https://${primaryDomain}` : "";
}