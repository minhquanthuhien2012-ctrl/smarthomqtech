import { Router } from "express";
import crypto from "crypto";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { toolDefinitions, executeTool } from "../anthropic/tools.js";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();

const ZALO_OA_SECRET = "TGo-n7-mcmjl629xav";

const SYSTEM_PROMPT = `Bạn là nhân viên tư vấn bán hàng của **SmartHomeQ** — cửa hàng chuyên thiết bị nhà thông minh tại Việt Nam.
Website chính thức: https://smarthomeq.tech
📞 Đặt hàng và tư vấn trực tiếp ĐT/Zalo: 0909 167 046

Nhiệm vụ của bạn:
- Tư vấn khách hàng về sản phẩm nhà thông minh: công tắc, cảm biến, camera, khóa cửa, rèm tự động, đèn thông minh, hub, aptomat, motor cửa cổng, loa thông minh, v.v.
- Luôn dùng công cụ fetch_url để lấy thông tin thực tế từ website trước khi trả lời.
- Khi báo giá luôn nhắc: giá chưa có VAT hóa đơn và chưa có công lắp đặt.
- Trả lời ngắn gọn phù hợp Zalo (không dùng markdown phức tạp, không hiển thị hình ảnh).
- Luôn ưu tiên tư vấn Zigbee hơn WiFi.`;

function verifyZaloSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", ZALO_OA_SECRET)
    .update(body)
    .digest("hex");
  return hash === signature;
}

async function sendZaloMessage(accessToken: string, userId: string, text: string) {
  await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "access_token": accessToken,
    },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text: text.slice(0, 2000) },
    }),
  });
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
  const signature = req.headers["x-zevent-signature"] as string ?? "";
  const rawBody = JSON.stringify(req.body);

  if (signature && !verifyZaloSignature(rawBody, signature.replace("sha256=", ""))) {
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  const body = req.body as {
    event_name?: string;
    message?: { text?: string; msg_id?: string };
    sender?: { id?: string };
    app_id?: string | number;
  };

  if (body.event_name !== "user_send_text" || !body.message?.text || !body.sender?.id) {
    res.status(200).json({ error: 0 });
    return;
  }

  const userId = body.sender.id;
  const userText = body.message.text;

  res.status(200).json({ error: 0 });

  const ZALO_ACCESS_TOKEN = "4544700640850963554:KcaEvbjTxlAMfsiwspmsBkmIyqpGeqkvtkvwuDXOwztRPvyDXsffxSAfLiwdYrQH";
  getAiReply(userText).then(reply => sendZaloMessage(ZALO_ACCESS_TOKEN, userId, reply)).catch(console.error);
});

export default router;
