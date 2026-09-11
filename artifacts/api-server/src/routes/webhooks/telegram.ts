import { Router } from "express";
import { db, connections } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateAiReply } from "../../lib/ai-reply.js";
import { getTelegramWebhookSecret, sendTelegramMessage } from "../../lib/telegram.js";

const router = Router();

interface TelegramUpdate {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number | string; username?: string };
  };
}

function matchesConfiguredChat(
  configuredChatId: string,
  chat?: { id?: number | string; username?: string },
) {
  if (!chat) return false;
  const actualId = chat.id === undefined ? "" : String(chat.id);
  const actualUsername = chat.username ? `@${chat.username}` : "";
  return configuredChatId === actualId
    || configuredChatId.toLowerCase() === actualUsername.toLowerCase();
}

async function handleTelegramUpdate(
  connectionId: number,
  update: TelegramUpdate,
  receivedSecret: string,
) {
  const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
  if (!connection || connection.type !== "telegram" || !connection.isActive) return;

  const config = connection.config as Record<string, string>;
  const text = update.message?.text?.trim();
  const chat = update.message?.chat;
  const chatId = config.chatId?.trim() ?? "";
  const botToken = config.botToken?.trim() ?? "";
  const expectedSecret = getTelegramWebhookSecret(botToken, connectionId);

  if (
    !text
    || !botToken
    || !chatId
    || receivedSecret !== expectedSecret
    || !matchesConfiguredChat(chatId, chat)
  ) return;

  const response = await generateAiReply(text, { channel: "Telegram" });
  const actualChatId = String(chat?.id ?? chatId);
  await sendTelegramMessage(botToken, actualChatId, response);
}

router.post("/telegram/:connectionId", (req, res) => {
  const connectionId = Number(req.params.connectionId);
  if (!Number.isInteger(connectionId)) {
    res.status(400).json({ error: "Invalid connection id" });
    return;
  }

  // Telegram retries slow webhook requests. Acknowledge first, then run AI asynchronously.
  res.status(200).json({ ok: true });
  const secret = req.header("x-telegram-bot-api-secret-token") ?? "";
  void handleTelegramUpdate(connectionId, req.body as TelegramUpdate, secret).catch((error) => {
    console.error("[Telegram webhook] Error:", error instanceof Error ? error.message : error);
  });
});

export default router;