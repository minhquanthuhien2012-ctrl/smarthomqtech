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
- Trả lời ngắn gọn phù hợp Zalo (không dùng markdown phức tạp, không hiển thị hình ảnh).
- Luôn ưu tiên tư vấn Zigbee hơn WiFi.`;

async function getZaloConfig(): Promise<{ accessToken: string; secretToken: string } | null> {
  const [conn] = await db.select().from(connections).where(eq(connections.type, "zalo")).limit(1);
  if (!conn) return null;
  const config = conn.config as Record<string, string>;
  return {
    accessToken: config.accessToken ?? "",
    secretToken: config.secretToken ?? "",
  };
}

function verifyZaloSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

async function sendZaloMessage(accessToken: string, userId: string, text: string) {
  const payload = JSON.stringify({
    recipient: { user_id: userId },
    message: { text: text.slice(0, 2000) },
  });

  // Thử v3.0 trước
  const res3 = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "access_token": accessToken },
    body: payload,
  });
  const data3 = await res3.json() as { error: number; message?: string };
  console.log("[Zalo] v3.0 response:", JSON.stringify(data3));

  if (data3.error === 0) {
    console.log("[Zalo] v3.0 sendMessage OK to", userId);
    return data3;
  }

  // Fallback v2.0 (HTTP API token dạng OA_ID:secret dùng được với v2.0)
  const res2 = await fetch("https://openapi.zalo.me/v2.0/oa/message", {
    method: "POST",
    headers: { "Content-Type": "application/json", "access_token": accessToken },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { attachment: { type: "template", payload: { template_type: "media", elements: [{ media_type: "text", url: "" }] } } },
    }),
  });
  const data2raw = await res2.text();
  console.log("[Zalo] v2.0 raw response:", data2raw);

  // v2.0 text message (simpler format)
  const res2txt = await fetch("https://openapi.zalo.me/v2.0/oa/message", {
    method: "POST",
    headers: { "Content-Type": "application/json", "access_token": accessToken },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text: text.slice(0, 2000) },
    }),
  });
  const data2 = await res2txt.json() as { error: number; message?: string };
  console.log("[Zalo] v2.0 text response:", JSON.stringify(data2));

  if (data2.error === 0) {
    console.log("[Zalo] v2.0 sendMessage OK to", userId);
  } else {
    console.error("[Zalo] Both v3 and v2 failed. Check token validity and OA permissions.");
    console.error("[Zalo] Token used (first 40 chars):", accessToken.slice(0, 40) + "...");
  }
  return data2;
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
      const assistantContent: Anthropic.MessageParam["content"] = response.content;
      currentMessages.push({ role: "assistant", content: assistantContent });

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

router.get("/zalo", (req, res) => {
  res.json({ status: "ok", message: "Zalo webhook endpoint active" });
});

router.post("/zalo", async (req, res) => {
  // Log toàn bộ request để debug
  console.log("[Zalo] incoming headers:", JSON.stringify(req.headers));
  console.log("[Zalo] incoming body:", JSON.stringify(req.body));

  const config = await getZaloConfig();
  if (!config || !config.accessToken) {
    console.error("[Zalo] No Zalo connection configured in DB");
    res.status(200).json({ error: 0 });
    return;
  }

  // Xác thực chữ ký (dùng raw body)
  const signature = (req.headers["x-zevent-signature"] as string ?? "").replace("sha256=", "");
  if (signature && req.rawBody) {
    if (!verifyZaloSignature(req.rawBody, signature, config.secretToken)) {
      console.error("[Zalo] Signature mismatch! Expected secret:", config.secretToken);
      res.status(403).json({ error: "Invalid signature" });
      return;
    }
    console.log("[Zalo] Signature OK");
  } else {
    console.log("[Zalo] No signature header — skipping verification");
  }

  const body = req.body as {
    event_name?: string;
    message?: { text?: string; msg_id?: string };
    sender?: { id?: string };
    follower?: { id?: string };
    app_id?: string | number;
  };

  // Xử lý nhiều dạng event Zalo OA
  const eventName = body.event_name ?? "";
  const userId = body.sender?.id ?? body.follower?.id ?? "";
  const userText = body.message?.text ?? "";

  console.log("[Zalo] event_name:", eventName, "| userId:", userId, "| text:", userText);

  if (!["user_send_text", "user_send_image", "user_send_sticker"].includes(eventName) || !userText || !userId) {
    console.log("[Zalo] Not a text message — skipping AI reply");
    res.status(200).json({ error: 0 });
    return;
  }

  // Trả về 200 ngay để Zalo không retry
  res.status(200).json({ error: 0 });

  // Gọi AI và gửi trả lời async
  getAiReply(userText)
    .then(reply => sendZaloMessage(config.accessToken, userId, reply))
    .catch(err => console.error("[Zalo] AI/send error:", err));
});

export default router;
