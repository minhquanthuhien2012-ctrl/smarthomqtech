import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, userChatbots, users, aiBrainMemories } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { eq, asc, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { toolDefinitions, executeTool } from "../anthropic/tools.js";
import { BASE_SYSTEM_PROMPT } from "../../lib/ai-assistant-config.js";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();
router.use(requireAuth);

async function buildSystemPrompt(userId: number): Promise<string> {
  const [user] = await db.select({ displayName: users.displayName, email: users.email })
    .from(users).where(eq(users.id, userId));

  const [chatbot] = await db.select().from(userChatbots).where(eq(userChatbots.userId, userId));

  const memories = await db.select({ content: aiBrainMemories.content, category: aiBrainMemories.category })
    .from(aiBrainMemories)
    .where(eq(aiBrainMemories.userId, userId))
    .orderBy(desc(aiBrainMemories.importance))
    .limit(30);

  let prompt = BASE_SYSTEM_PROMPT;

  if (user) {
    prompt += `\n\n== THÔNG TIN NGƯỜI DÙNG ==\n- Tên: ${user.displayName || "Khách hàng"}\n- Email: ${user.email}`;
    prompt += `\n- Hãy xưng hô thân mật, gọi tên người dùng khi phù hợp.`;
  }

  if (chatbot?.systemPrompt) {
    prompt += `\n\n== TUỲ CHỈNH AI ==\n${chatbot.systemPrompt}`;
  }

  if (memories.length > 0) {
    prompt += `\n\n== KÝ ỨC VỀ NGƯỜI DÙNG NÀY ==\n`;
    prompt += memories.map(m => `[${m.category}] ${m.content}`).join("\n");
    prompt += `\n\nSử dụng thông tin trên để cá nhân hoá câu trả lời cho người dùng này.`;
  }

  return prompt;
}

async function autoLearnMemory(userId: number, userMessage: string, assistantResponse: string) {
  try {
    const learnPrompt = `Phân tích đoạn hội thoại sau và trích xuất thông tin quan trọng về người dùng cần ghi nhớ (tên, sở thích, ngân sách, thiết bị đã có, dự án đang làm, v.v.).
Chỉ trả về JSON array, mỗi item có: {category: string, content: string, importance: number (0-1)}.
Nếu không có thông tin quan trọng, trả về [].

Tin nhắn của người dùng: "${userMessage}"
Trả lời của AI: "${assistantResponse.slice(0, 500)}"`;

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: learnPrompt }],
    });
    const text = resp.content[0].type === "text" ? resp.content[0].text : "[]";
    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const items = JSON.parse(cleanText) as Array<{ category: string; content: string; importance: number }>;
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items.slice(0, 3)) {
        await db.insert(aiBrainMemories).values({
          userId,
          category: item.category || "general",
          content: item.content,
          importance: item.importance ?? 0.5,
          source: "chat",
        });
      }
    }
  } catch {
    // silent - auto-learn is best-effort
  }
}

router.get("/conversations", async (req: AuthRequest, res) => {
  const rows = await db.select().from(conversations)
    .where(eq(conversations.userId, req.userId!))
    .orderBy(desc(conversations.createdAt));
  res.json(rows);
});

router.post("/conversations", async (req: AuthRequest, res) => {
  const Body = z.object({ title: z.string().min(1) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [conv] = await db.insert(conversations)
    .values({ title: parsed.data.title, userId: req.userId! })
    .returning();
  res.status(201).json(conv);
});

router.get("/conversations/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ ...conv, messages: msgs });
});

router.delete("/conversations/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(messages).where(eq(messages.conversationId, id));
  const deleted = await db.delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)))
    .returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.post("/conversations/:id/messages", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const Body = z.object({ content: z.string().min(1) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  const userContent = parsed.data.content;
  await db.insert(messages).values({ conversationId: id, role: "user", content: userContent });

  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  const chatMessages: Anthropic.MessageParam[] = history
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  const systemPrompt = await buildSystemPrompt(req.userId!);

  const [userChatbot] = await db.select({ model: userChatbots.model })
    .from(userChatbots).where(eq(userChatbots.userId, req.userId!));
  const model = userChatbot?.model || "claude-sonnet-4-6";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    let continueLoop = true;
    let currentMessages = [...chatMessages];

    while (continueLoop) {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 8192,
        system: systemPrompt,
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
            try { parsedInput = JSON.parse(currentToolInputStr) as Record<string, unknown>; } catch { /**/ }
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
          type: "tool_use" as const, id: t.id, name: t.name, input: t.input,
        }));
        if (fullResponse && typeof assistantContent !== "string") {
          assistantContent.unshift({ type: "text" as const, text: fullResponse });
        }
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

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // Auto-learn in background
    autoLearnMemory(req.userId!, userContent, fullResponse).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

export default router;
