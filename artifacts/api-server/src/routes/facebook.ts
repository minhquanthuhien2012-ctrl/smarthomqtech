import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { db, userConnections } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();
const GRAPH_VERSION = "v26.0";
const SESSION_SECRET = process.env.SESSION_SECRET || "smarthomeq-secret-2024";
const WEB_APP_PATH = "/webapp/connections";

const FacebookPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  access_token: z.string(),
  picture: z.object({ data: z.object({ url: z.string() }) }).optional(),
  tasks: z.array(z.string()).optional(),
});

type FacebookPage = z.infer<typeof FacebookPageSchema>;
type StoredPage = {
  id: string;
  name: string;
  pictureUrl: string;
  tasks: string[];
  encryptedAccessToken: string;
};

function encryptionKey() {
  return crypto.createHash("sha256").update(SESSION_SECRET).digest();
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function getOrigin(req: AuthRequest) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  return `${forwardedProto}://${forwardedHost}`;
}

function getRedirectUri(req: AuthRequest) {
  return process.env.META_REDIRECT_URI || `${getOrigin(req)}/api/facebook/oauth/callback`;
}

function getWebAppRedirect(req: AuthRequest, query: string) {
  const base = process.env.WEB_APP_URL || `${getOrigin(req)}${WEB_APP_PATH}`;
  return `${base}${base.includes("?") ? "&" : "?"}${query}`;
}

function getFacebookConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Facebook OAuth chưa được cấu hình META_APP_ID/META_APP_SECRET");
  }
  return { appId, appSecret };
}

async function graphJson<T>(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Facebook Graph API lỗi (${response.status})`);
  }
  return body;
}

function publicPage(page: StoredPage) {
  return {
    id: page.id,
    name: page.name,
    pictureUrl: page.pictureUrl,
    tasks: page.tasks,
  };
}

async function getConnection(userId: number) {
  const [connection] = await db.select().from(userConnections).where(
    and(eq(userConnections.userId, userId), eq(userConnections.type, "facebook")),
  );
  return connection;
}

router.get("/oauth/start", requireAuth, (req: AuthRequest, res) => {
  try {
    const { appId } = getFacebookConfig();
    const redirectUri = getRedirectUri(req);
    const state = jwt.sign(
      { purpose: "facebook-oauth", userId: req.userId, redirectUri },
      SESSION_SECRET,
      { expiresIn: "10m" },
    );
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set(
      "scope",
      [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_engagement",
        "pages_manage_posts",
        "pages_manage_metadata",
        "pages_messaging",
        "read_insights",
      ].join(","),
    );
    res.json({ url: url.toString() });
  } catch (error) {
    req.log?.error({ err: error }, "Facebook OAuth configuration error");
    res.status(503).json({ error: "Facebook OAuth chưa được cấu hình" });
  }
});

router.get("/oauth/callback", async (req: AuthRequest, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    res.redirect(getWebAppRedirect(req, "facebook=error&reason=missing_callback"));
    return;
  }

  try {
    const payload = jwt.verify(state, SESSION_SECRET) as {
      purpose?: string;
      userId?: number;
      redirectUri?: string;
    };
    if (payload.purpose !== "facebook-oauth" || !payload.userId || !payload.redirectUri) {
      throw new Error("OAuth state không hợp lệ");
    }

    const { appId, appSecret } = getFacebookConfig();
    const tokenBody = await graphJson<{ access_token: string }>("oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: payload.redirectUri,
      code,
    });
    const profile = await graphJson<{ id: string }>("me", {
      access_token: tokenBody.access_token,
      fields: "id",
    });
    const pagesBody = await graphJson<{ data: FacebookPage[] }>("me/accounts", {
      access_token: tokenBody.access_token,
      fields: "id,name,access_token,picture{url},tasks",
      limit: "100",
    });

    const pages = pagesBody.data.map(page => FacebookPageSchema.parse(page));
    const storedPages: StoredPage[] = pages.map(page => ({
      id: page.id,
      name: page.name,
      pictureUrl: page.picture?.data.url || "",
      tasks: page.tasks || [],
      encryptedAccessToken: encrypt(page.access_token),
    }));
    const existing = await getConnection(payload.userId);
    const config = {
      version: 1,
      graphVersion: GRAPH_VERSION,
      facebookUserId: profile.id,
      encryptedUserAccessToken: encrypt(tokenBody.access_token),
      pages: storedPages,
      selectedPageId: storedPages[0]?.id || "",
    };

    if (existing) {
      await db.update(userConnections).set({
        name: storedPages[0]?.name || "Facebook Pages",
        config,
        status: storedPages.length ? "connected" : "connected_no_pages",
        isActive: true,
        updatedAt: new Date(),
      }).where(eq(userConnections.id, existing.id));
    } else {
      await db.insert(userConnections).values({
        userId: payload.userId,
        type: "facebook",
        name: storedPages[0]?.name || "Facebook Pages",
        config,
        status: storedPages.length ? "connected" : "connected_no_pages",
        isActive: true,
      });
    }

    res.redirect(getWebAppRedirect(req, "facebook=connected"));
  } catch (error) {
    req.log?.error({ err: error }, "Facebook OAuth callback failed");
    res.redirect(getWebAppRedirect(req, "facebook=error&reason=oauth_failed"));
  }
});

router.get("/pages", requireAuth, async (req: AuthRequest, res) => {
  const connection = await getConnection(req.userId!);
  if (!connection) {
    res.json({ connected: false, pages: [], selectedPageId: "" });
    return;
  }
  const config = connection.config as {
    pages?: StoredPage[];
    selectedPageId?: string;
    facebookUserId?: string;
  };
  res.json({
    connected: connection.isActive && connection.status.startsWith("connected"),
    connectionId: connection.id,
    facebookUserId: config.facebookUserId || "",
    pages: (config.pages || []).map(publicPage),
    selectedPageId: config.selectedPageId || "",
    status: connection.status,
  });
});

router.post("/pages/select", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({ pageId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "pageId không hợp lệ" });
    return;
  }
  const connection = await getConnection(req.userId!);
  if (!connection) {
    res.status(404).json({ error: "Chưa kết nối Facebook" });
    return;
  }
  const config = connection.config as { pages?: StoredPage[]; selectedPageId?: string };
  if (!config.pages?.some(page => page.id === parsed.data.pageId)) {
    res.status(404).json({ error: "Page không thuộc tài khoản Facebook này" });
    return;
  }
  const selected = config.pages.find(page => page.id === parsed.data.pageId)!;
  const nextConfig = { ...config, selectedPageId: selected.id };
  await db.update(userConnections).set({
    name: selected.name,
    config: nextConfig,
    updatedAt: new Date(),
  }).where(eq(userConnections.id, connection.id));
  res.json({ ok: true, selectedPageId: selected.id, name: selected.name });
});

export default router;