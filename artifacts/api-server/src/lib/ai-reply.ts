import { anthropic } from "@workspace/integrations-anthropic-ai";
import type Anthropic from "@anthropic-ai/sdk";
import { BASE_SYSTEM_PROMPT } from "./ai-assistant-config.js";
import { executeTool, toolDefinitions } from "../routes/anthropic/tools.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function generateAiReply(
  userMessage: string,
  options?: { model?: string; channel?: string },
) {
  const channelPrompt = options?.channel
    ? `\n\n== KÊNH GIAO TIẾP ==\nBạn đang trả lời qua ${options.channel}. Trả lời ngắn gọn, dễ đọc trên điện thoại; không dùng bảng.`
    : "";
  const systemPrompt = `${BASE_SYSTEM_PROMPT}${channelPrompt}`;
  let currentMessages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let fullResponse = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await anthropic.messages.create({
      model: options?.model || DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolDefinitions,
      messages: currentMessages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    fullResponse += text;

    if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      return fullResponse.trim() || "Xin lỗi, tôi chưa thể trả lời lúc này.";
    }

    currentMessages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const tool of toolUseBlocks) {
      try {
        const result = await executeTool(tool.name, tool.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: `Lỗi: ${message}`,
          is_error: true,
        });
      }
    }

    currentMessages.push({ role: "user", content: toolResults });
  }

  return fullResponse.trim() || "Xin lỗi, tôi chưa thể trả lời lúc này.";
}