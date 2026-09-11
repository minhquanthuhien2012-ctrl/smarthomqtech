import { Router } from "express";
import { db } from "@workspace/db";
import { connections } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import WebSocket from "ws";

const router = Router();

const ConnectionBody = z.object({
  name: z.string().min(1),
  type: z.enum([
    "telegram",
    "messenger",
    "zalo_creator",
    "zalo_oa",
    "xiaozhi",
    // Legacy values kept so existing connections remain editable.
    "zalo",
    "webhook",
    "websocket",
  ]),
  config: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

const activeWsConnections = new Map<number, WebSocket>();

function telegramConfigError(config: Record<string, unknown>) {
  const botToken = typeof config.botToken === "string" ? config.botToken.trim() : "";
  const chatId = typeof config.chatId === "string" ? config.chatId.trim() : "";

  if (!botToken || !chatId) {
    return "Telegram cần cả Bot Token và Chat ID";
  }
  return null;
}

async function verifyTelegram(botToken: string, chatId: string) {
  const baseUrl = `https://api.telegram.org/bot${encodeURIComponent(botToken)}`;
  const getMeResponse = await fetch(`${baseUrl}/getMe`, {
    signal: AbortSignal.timeout(10000),
  });
  const getMeResult = await getMeResponse.json() as { ok?: boolean };

  if (!getMeResponse.ok || !getMeResult.ok) {
    throw new Error("Bot Token Telegram không hợp lệ");
  }

  const getChatResponse = await fetch(`${baseUrl}/getChat?chat_id=${encodeURIComponent(chatId)}`, {
    signal: AbortSignal.timeout(10000),
  });
  const getChatResult = await getChatResponse.json() as {
    ok?: boolean;
    description?: string;
  };

  if (!getChatResponse.ok || !getChatResult.ok) {
    throw new Error(getChatResult.description
      ? `Chat ID Telegram không hợp lệ: ${getChatResult.description}`
      : "Chat ID Telegram không hợp lệ hoặc bot chưa được thêm vào chat");
  }
}

router.get("/", async (_req, res) => {
  const result = await db.select().from(connections).orderBy(connections.createdAt);
  res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = ConnectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  if (parsed.data.type === "telegram") {
    const configError = telegramConfigError(parsed.data.config);
    if (configError) { res.status(400).json({ error: configError }); return; }
  }
  const [row] = await db.insert(connections).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(connections).where(eq(connections.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ConnectionBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [existing] = await db.select().from(connections).where(eq(connections.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const nextType = parsed.data.type ?? existing.type;
  const nextConfig = (parsed.data.config ?? existing.config) as Record<string, unknown>;
  if (nextType === "telegram") {
    const configError = telegramConfigError(nextConfig);
    if (configError) { res.status(400).json({ error: configError }); return; }
  }
  const [row] = await db.update(connections).set({ ...parsed.data, updatedAt: new Date() }).where(eq(connections.id, id)).returning();
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const ws = activeWsConnections.get(id);
  if (ws) { ws.terminate(); activeWsConnections.delete(id); }
  const deleted = await db.delete(connections).where(eq(connections.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.post("/:id/connect", async (req, res) => {
  const id = Number(req.params.id);
  const [conn] = await db.select().from(connections).where(eq(connections.id, id));
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const config = conn.config as Record<string, string>;

  if (conn.type === "telegram") {
    const configError = telegramConfigError(config);
    if (configError) {
      await db.update(connections).set({ status: "error", updatedAt: new Date() }).where(eq(connections.id, id));
      res.status(400).json({ error: configError });
      return;
    }

    try {
      await verifyTelegram(config.botToken.trim(), config.chatId.trim());
      await db.update(connections).set({
        status: "connected",
        lastConnectedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(connections.id, id));
      res.json({ status: "connected" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể xác thực Telegram";
      await db.update(connections).set({ status: "error", updatedAt: new Date() }).where(eq(connections.id, id));
      res.status(502).json({ error: message });
    }
    return;
  }

  if (conn.type === "xiaozhi") {
    const url = config.wsUrl ?? "";
    if (!url) { res.status(400).json({ error: "wsUrl required" }); return; }

    const existing = activeWsConnections.get(id);
    if (existing && existing.readyState === WebSocket.OPEN) {
      res.json({ status: "already_connected" });
      return;
    }

    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.terminate();
        }
      }, 10000);

      await new Promise<void>((resolve, reject) => {
        ws.once("open", () => { clearTimeout(timeout); resolve(); });
        ws.once("error", (err) => { clearTimeout(timeout); reject(err); });
      });

      activeWsConnections.set(id, ws);
      ws.on("close", async () => {
        activeWsConnections.delete(id);
        await db.update(connections).set({ status: "disconnected", updatedAt: new Date() }).where(eq(connections.id, id));
      });

      await db.update(connections).set({ status: "connected", lastConnectedAt: new Date(), updatedAt: new Date() }).where(eq(connections.id, id));
      res.json({ status: "connected" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.update(connections).set({ status: "error", updatedAt: new Date() }).where(eq(connections.id, id));
      res.status(500).json({ error: msg });
    }
    return;
  }

  if (conn.type === "zalo") {
    await db.update(connections).set({ status: "connected", lastConnectedAt: new Date(), updatedAt: new Date() }).where(eq(connections.id, id));
    res.json({ status: "connected", webhookUrl: `/api/admin/connections/${id}/webhook/zalo` });
    return;
  }

  res.json({ status: "connected" });
});

router.post("/:id/disconnect", async (req, res) => {
  const id = Number(req.params.id);
  const ws = activeWsConnections.get(id);
  if (ws) { ws.terminate(); activeWsConnections.delete(id); }
  await db.update(connections).set({ status: "disconnected", updatedAt: new Date() }).where(eq(connections.id, id));
  res.json({ status: "disconnected" });
});

router.get("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const [conn] = await db.select().from(connections).where(eq(connections.id, id));
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }
  const ws = activeWsConnections.get(id);
  const wsState = ws ? (ws.readyState === WebSocket.OPEN ? "open" : "closed") : "none";
  res.json({ status: conn.status, wsState });
});

export { activeWsConnections };
export default router;
