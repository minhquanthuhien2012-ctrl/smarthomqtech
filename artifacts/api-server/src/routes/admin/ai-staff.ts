import { Router } from "express";
import { toolDefinitions } from "../anthropic/tools.js";
import {
  AI_RESPONSE_RULES,
  AI_STYLE,
  BASE_SYSTEM_PROMPT,
} from "../../lib/ai-assistant-config.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    name: "AI tư vấn SmartHomeQ",
    description: "Nhân viên AI đang được sử dụng trên website SmartHomeQ.",
    model: "claude-sonnet-4-6",
    style: AI_STYLE,
    responseRules: AI_RESPONSE_RULES,
    systemPrompt: BASE_SYSTEM_PROMPT,
    tools: toolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
    })),
    dynamicContext: [
      "Tên và email người dùng hiện tại.",
      "Prompt tùy chỉnh được lưu trong cấu hình AI của người dùng.",
      "Bộ nhớ hội thoại có độ quan trọng cao của người dùng.",
    ],
  });
});

export default router;