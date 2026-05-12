import { Router } from "express";
import crypto from "crypto";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { toolDefinitions, executeTool } from "../anthropic/tools.js";
import { db, connections } from "@workspace/db";
import { eq } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();

const SYSTEM_PROMPT = `Bạn là nhân viên tư vấn bán hàng của **SmartHomeQ** — cửa hàng chuyên thiết bị nhà thông minh tại Việt Nam.
Website chính thức: https://smarthomeq.tech
📞 Đặt hàng và tư vấn trực tiếp ĐT/Zalo: 0909 167 046

Nhiệm vụ của bạn:
- Tư vấn khách hàng về sản phẩm nhà thông minh: công tắc, cảm biến, camera, khóa cửa, rèm tự động, đèn thông minh, hub, aptomat, motor cửa cổng, loa thông minh, v.v.
- Luôn dùng công cụ fetch_url để lấy thông tin thực tế từ website trước khi trả lời.
- Khi báo giá luôn nhắc: giá chưa có VAT hóa đơn và chưa có công lắp đặt.
- Trả lời ngắn gọn phù hợp Zalo (không dùng markdown, không dùng **, không dùng #, viết thường).
- Luôn ưu tiên tư vấn Zigbee hơn WiFi.`;

async function getZaloConfig(): Promise<{ accessToken: string; secretToken: string; oaAccessToken: string } | null> {
  const [conn] = await db.select().from(connections).where(eq(connections.type, "zalo")).limit(1);
  if (!conn) return null;
  const config = conn.config as Record<string, string>;
  return {
    accessToken: config.accessToken ?? "",
    secretToken: config.secretToken ?? "",
    oaAccessToken: config.oaAccessToken ?? "",
  };
}

function verifyMac(rawBody: Buffer, mac: string, secret: string): boolean {
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return hash === mac;
}

// Gửi tin nhắn Zalo — ưu tiên openapi.zalo.me (OA API, accessible từ ngoài VN)
// bot.zalo.me chỉ accessible trong mạng nội bộ VN nên không dùng được từ Replit North America
async function sendZaloBotMessage(
  botToken: string,
  userId: string,
  text: string,
  oaAccessToken?: string,
) {
  const shortText = text.slice(0, 2000);
  console.log("[Zalo] Sending to userId:", userId, "| text length:", text.length);

  // Thử openapi.zalo.me trước nếu có OA access token
  if (oaAccessToken) {
    console.log("[Zalo] Using openapi.zalo.me (OA API) with oaAccessToken");
    const body = JSON.stringify({
      recipient: { user_id: userId },
      message: { text: shortText },
    });
    try {
      const res = await fetch("https://openapi.zalo.me/v2.0/oa/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": oaAccessToken,
        },
        body,
      });
      const raw = await res.text();
      console.log("[Zalo] OA API response (", res.status, "):", raw);
      const parsed = JSON.parse(raw) as { error: number; message?: string };
      if (parsed.error === 0) return parsed;
      console.warn("[Zalo] OA API error, falling back to bot.zalo.me:", raw);
    } catch (err) {
      console.warn("[Zalo] OA API failed:", err instanceof Error ? err.message : err);
    }
  }

  // Fallback: bot.zalo.me (chỉ hoạt động trong VN network)
  console.log("[Zalo] Using bot.zalo.me with botToken");
  const body = JSON.stringify({
    recipient: { user_id: userId },
    message: { text: shortText },
  });
  const res = await fetch("https://bot.zalo.me/api/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "access_token": botToken,
    },
    body,
  });
  const raw = await res.text();
  console.log("[Zalo] Bot API response (", res.status, "):", raw);
  try {
    return JSON.parse(raw) as { error: number; message?: string };
  } catch {
    return { error: -1, message: raw };
  }
}

async function getAiReply(userMessage: string): Promise<string> {
  let fullResponse = "";
  let continueLoop = true;
  let currentMessages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages: currentMessages,
    });

    for (const block of response.content) {
      if (block.type === "text") fullResponse += block.text;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
      currentMessages.push({ role: "assistant", content: response.content });

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }> = [];
      for (const tool of toolUseBlocks) {
        if (tool.type !== "tool_use") continue;
        try {
          const result = await executeTool(tool.name, tool.input as Record<string, unknown>);
          toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: `Lỗi: ${msg}`, is_error: true });
        }
      }
      currentMessages.push({ role: "user", content: toolResults });
      fullResponse = "";
    } else {
      continueLoop = false;
    }
  }

  return fullResponse || "Xin lỗi, tôi không thể trả lời lúc này. Vui lòng liên hệ 0909 167 046.";
}

router.get("/zalo", (_req, res) => {
  res.json({ status: "ok", message: "Zalo Bot webhook active" });
});

router.post("/zalo", async (req, res) => {
  // Log đầy đủ để debug
  console.log("[Zalo Bot] Headers:", JSON.stringify({
    mac: req.headers["mac"],
    "x-zevent-signature": req.headers["x-zevent-signature"],
    "content-type": req.headers["content-type"],
  }));
  console.log("[Zalo Bot] Body:", JSON.stringify(req.body));

  const config = await getZaloConfig();
  if (!config?.accessToken) {
    console.error("[Zalo Bot] No config in DB");
    res.status(200).json({ error: 0 });
    return;
  }

  // Zalo Bot dùng header "mac" để xác thực (khác OA dùng x-zevent-signature)
  const mac = (req.headers["mac"] as string) ?? (req.headers["x-zevent-signature"] as string ?? "").replace("sha256=", "");
  if (mac && req.rawBody && config.secretToken) {
    if (!verifyMac(req.rawBody, mac, config.secretToken)) {
      console.error("[Zalo Bot] MAC mismatch");
      res.status(403).json({ error: "Invalid mac" });
      return;
    }
    console.log("[Zalo Bot] MAC OK");
  } else {
    console.log("[Zalo Bot] No mac header — skipping verification");
  }

  // Zalo Bot payload structure (bot.zalo.me)
  const body = req.body as {
    event_name?: string;
    message?: {
      text?: string;
      msg_id?: string;
      from?: { id?: string; display_name?: string };
    };
    sender?: { id?: string };
    user_id_by_app?: string;
    follower?: { id?: string };
    from?: { id?: string };
    app_id?: string | number;
  };

  const eventName = body.event_name ?? "";
  // Zalo Bot đặt userId trong message.from.id (khác OA)
  const userId =
    body.message?.from?.id ??
    body.sender?.id ??
    body.user_id_by_app ??
    body.follower?.id ??
    body.from?.id ??
    "";
  const userText = body.message?.text ?? "";

  console.log("[Zalo Bot] event:", eventName, "| userId:", userId, "| text:", userText);

  // Zalo Bot dùng event names dạng "message.text.received" (khác OA dùng "user_send_text")
  const textEvents = [
    "message.text.received",      // Zalo Bot format
    "user_send_text",             // Zalo OA format (fallback)
    "message.image.received",
    "user_send_image",
  ];
  const stickerEvents = ["message.sticker.received", "user_send_sticker"];

  if (!userId) {
    console.log("[Zalo Bot] Skipped — no userId");
    res.status(200).json({ error: 0 });
    return;
  }

  // Sticker → trả lời thân thiện
  if (stickerEvents.includes(eventName)) {
    res.status(200).json({ error: 0 });
    getAiReply("Khách gửi sticker, hãy chào thân thiện và hỏi khách cần tư vấn gì về nhà thông minh.")
      .then(reply => sendZaloBotMessage(config.accessToken, userId, reply))
      .catch(err => console.error("[Zalo Bot] Error:", err));
    return;
  }

  if (!textEvents.includes(eventName) || !userText) {
    console.log("[Zalo Bot] Skipped — not a handled event or no text");
    res.status(200).json({ error: 0 });
    return;
  }

  // Trả 200 ngay để Zalo không retry
  res.status(200).json({ error: 0 });

  // Gọi AI async và gửi trả lời
  getAiReply(userText)
    .then(reply => {
      console.log("[Zalo] AI replied:", reply.slice(0, 100) + "...");
      return sendZaloBotMessage(config.accessToken, userId, reply, config.oaAccessToken || undefined);
    })
    .catch(err => console.error("[Zalo] Error:", err));
});

export default router;
