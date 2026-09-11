import crypto from "crypto";

const TELEGRAM_TIMEOUT_MS = 10000;

function telegramBaseUrl(botToken: string) {
  return `https://api.telegram.org/bot${encodeURIComponent(botToken)}`;
}

interface TelegramApiResult {
  ok?: boolean;
  description?: string;
}

async function telegramRequest<T extends TelegramApiResult>(
  botToken: string,
  method: string,
  init?: RequestInit,
) {
  const response = await fetch(`${telegramBaseUrl(botToken)}/${method}`, {
    ...init,
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
  });
  const result = await response.json() as T;
  return { response, result };
}

export async function verifyTelegram(botToken: string, chatId: string) {
  const getMe = await telegramRequest<TelegramApiResult>(botToken, "getMe");
  if (!getMe.response.ok || !getMe.result.ok) {
    throw new Error("Bot Token Telegram không hợp lệ");
  }

  const getChat = await telegramRequest<TelegramApiResult>(
    botToken,
    `getChat?chat_id=${encodeURIComponent(chatId)}`,
  );
  if (!getChat.response.ok || !getChat.result.ok) {
    throw new Error(getChat.result.description
      ? `Chat ID Telegram không hợp lệ: ${getChat.result.description}`
      : "Chat ID Telegram không hợp lệ hoặc bot chưa được thêm vào chat");
  }
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const result = await telegramRequest<TelegramApiResult>(botToken, "sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!result.response.ok || !result.result.ok) {
    throw new Error(result.result.description
      ? `Telegram không gửi được tin: ${result.result.description}`
      : "Telegram không gửi được tin");
  }
}

export function getTelegramWebhookSecret(botToken: string, connectionId: number) {
  return crypto
    .createHash("sha256")
    .update(`${connectionId}:${botToken}`)
    .digest("hex");
}

export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  connectionId: number,
) {
  const result = await telegramRequest<TelegramApiResult>(botToken, "setWebhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      secret_token: getTelegramWebhookSecret(botToken, connectionId),
    }),
  });

  if (!result.response.ok || !result.result.ok) {
    throw new Error(result.result.description
      ? `Không thể cài webhook Telegram: ${result.result.description}`
      : "Không thể cài webhook Telegram");
  }
}

export async function deleteTelegramWebhook(botToken: string) {
  try {
    await telegramRequest<TelegramApiResult>(botToken, "deleteWebhook", {
      method: "POST",
    });
  } catch {
    // Disconnect should still complete if Telegram is temporarily unavailable.
  }
}