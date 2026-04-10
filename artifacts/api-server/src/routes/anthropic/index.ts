import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { eq, asc } from "drizzle-orm";
import {
  CreateAnthropicConversationBody,
  SendAnthropicMessageBody,
  GetAnthropicConversationParams,
  DeleteAnthropicConversationParams,
  ListAnthropicMessagesParams,
  SendAnthropicMessageParams,
} from "@workspace/api-zod";
import { toolDefinitions, executeTool } from "./tools.js";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();

const SYSTEM_PROMPT = `Bạn là một trợ lý AI thông minh, được tích hợp với Google Drive và nhiều công cụ hữu ích. Bạn nói chuyện bằng tiếng Việt một cách tự nhiên và thân thiện.

Các công cụ bạn có:
- calculator: Tính toán số học
- get_current_time: Lấy thời gian hiện tại  
- fetch_url: Lấy nội dung từ URL
- gdrive_list_files: Liệt kê file trong Google Drive
- gdrive_read_file: Đọc nội dung file (Docs, Sheets, Slides)
- gdrive_search: Tìm kiếm file theo tên/nội dung

Khi người dùng hỏi về file, tài liệu hay dữ liệu, hãy chủ động dùng công cụ Google Drive để lấy thông tin thực tế và trả lời chính xác. Luôn trả lời dựa trên dữ liệu thực từ công cụ, không bịa đặt.`;

router.get("/conversations", async (_req, res) => {
  const result = await db.select().from(conversations).orderBy(conversations.createdAt);
  res.json(result);
});

router.post("/conversations", async (req, res) => {
  const parsed = CreateAnthropicConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const [conv] = await db.insert(conversations).values({ title: parsed.data.title }).returning();
  res.status(201).json(conv);
});

router.get("/conversations/:id", async (req, res) => {
  const parsed = GetAnthropicConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, parsed.data.id));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, parsed.data.id)).orderBy(asc(messages.createdAt));
  res.json({ ...conv, messages: msgs });
});

router.delete("/conversations/:id", async (req, res) => {
  const parsed = DeleteAnthropicConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(messages).where(eq(messages.conversationId, parsed.data.id));
  const deleted = await db.delete(conversations).where(eq(conversations.id, parsed.data.id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.get("/conversations/:id/messages", async (req, res) => {
  const parsed = ListAnthropicMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, parsed.data.id)).orderBy(asc(messages.createdAt));
  res.json(msgs);
});

router.post("/conversations/:id/messages", async (req, res) => {
  const paramsParsed = SendAnthropicMessageParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = SendAnthropicMessageBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const convId = paramsParsed.data.id;
  const userContent = bodyParsed.data.content;

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messages).values({ conversationId: convId, role: "user", content: userContent });

  const history = await db.select().from(messages).where(eq(messages.conversationId, convId)).orderBy(asc(messages.createdAt));
  const chatMessages: Anthropic.MessageParam[] = history
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    let continueLoop = true;
    let currentMessages = [...chatMessages];

    while (continueLoop) {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: currentMessages,
      });

      type ToolUseBlock = { id: string; name: string; input: Record<string, unknown> };
      let toolUseBlocks: ToolUseBlock[] = [];
      let currentToolId = "";
      let currentToolName = "";
      let currentToolInputStr = "";
      let stopReason = "";

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            currentToolId = event.content_block.id;
            currentToolName = event.content_block.name;
            currentToolInputStr = "";
            res.write(`data: ${JSON.stringify({ tool_call: { name: currentToolName, status: "starting" } })}\n\n`);
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            fullResponse += event.delta.text;
            res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
          } else if (event.delta.type === "input_json_delta") {
            currentToolInputStr += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop") {
          if (currentToolId && currentToolName) {
            let parsedInput: Record<string, unknown> = {};
            try { parsedInput = JSON.parse(currentToolInputStr) as Record<string, unknown>; } catch { /* noop */ }
            toolUseBlocks.push({ id: currentToolId, name: currentToolName, input: parsedInput });
            currentToolId = "";
            currentToolName = "";
            currentToolInputStr = "";
          }
        } else if (event.type === "message_delta") {
          stopReason = event.delta.stop_reason ?? "";
        }
      }

      if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
        const assistantContent: Anthropic.MessageParam["content"] = toolUseBlocks.map(t => ({
          type: "tool_use" as const,
          id: t.id,
          name: t.name,
          input: t.input,
        }));
        if (fullResponse && typeof assistantContent !== "string") assistantContent.unshift({ type: "text" as const, text: fullResponse });
        currentMessages.push({ role: "assistant", content: assistantContent });

        const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }> = [];
        for (const tool of toolUseBlocks) {
          res.write(`data: ${JSON.stringify({ tool_call: { name: tool.name, status: "running" } })}\n\n`);
          try {
            const result = await executeTool(tool.name, tool.input);
            toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
            res.write(`data: ${JSON.stringify({ tool_call: { name: tool.name, status: "done" } })}\n\n`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: `Lỗi: ${msg}`, is_error: true });
            res.write(`data: ${JSON.stringify({ tool_call: { name: tool.name, status: "error", error: msg } })}\n\n`);
          }
        }

        currentMessages.push({ role: "user", content: toolResults });
        toolUseBlocks = [];
        fullResponse = "";
      } else {
        continueLoop = false;
      }
    }

    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

export default router;
