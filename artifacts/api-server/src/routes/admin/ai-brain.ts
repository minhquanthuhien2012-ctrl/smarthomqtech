import { Router } from "express";
import { db } from "@workspace/db";
import {
  aiBrainMemories, aiBrainConfig, dailyReports,
} from "@workspace/db";
import { eq, desc, asc, count, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

/* ─── Config ─── */
router.get("/config/:chatbotId", async (req, res) => {
  const chatbotId = Number(req.params.chatbotId);
  let [cfg] = await db.select().from(aiBrainConfig).where(eq(aiBrainConfig.chatbotId, chatbotId));
  if (!cfg) {
    [cfg] = await db.insert(aiBrainConfig).values({ chatbotId }).returning();
  }
  res.json(cfg);
});

router.patch("/config/:chatbotId", async (req, res) => {
  const chatbotId = Number(req.params.chatbotId);
  const Body = z.object({
    isAutoEnabled: z.boolean().optional(),
    scanIntervalMinutes: z.number().int().min(5).optional(),
    maxMemories: z.number().int().min(10).optional(),
    compressionThreshold: z.number().int().min(10).optional(),
    autoLearn: z.boolean().optional(),
    autoSuggest: z.boolean().optional(),
    autoAsk: z.boolean().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const existing = await db.select().from(aiBrainConfig).where(eq(aiBrainConfig.chatbotId, chatbotId));
  if (existing.length === 0) {
    const [row] = await db.insert(aiBrainConfig).values({ chatbotId, ...parsed.data }).returning();
    res.json(row); return;
  }

  const update: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.isAutoEnabled && parsed.data.scanIntervalMinutes) {
    const next = new Date();
    next.setMinutes(next.getMinutes() + (parsed.data.scanIntervalMinutes ?? existing[0].scanIntervalMinutes));
    update.nextScanAt = next;
  }

  const [row] = await db.update(aiBrainConfig).set(update).where(eq(aiBrainConfig.chatbotId, chatbotId)).returning();
  res.json(row);
});

/* ─── Memories ─── */
router.get("/memories", async (req, res) => {
  const chatbotId = req.query.chatbotId ? Number(req.query.chatbotId) : undefined;
  const category = req.query.category as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);

  let query = db.select().from(aiBrainMemories);
  const conditions = [];
  if (chatbotId) conditions.push(eq(aiBrainMemories.chatbotId, chatbotId));
  if (category) conditions.push(eq(aiBrainMemories.category, category));

  const rows = await db.select().from(aiBrainMemories)
    .where(conditions.length > 0 ? sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}` : undefined)
    .orderBy(desc(aiBrainMemories.importance), desc(aiBrainMemories.createdAt))
    .limit(limit).offset(offset);
  void query;

  const [{ value: total }] = await db.select({ value: count() }).from(aiBrainMemories);
  res.json({ memories: rows, total });
});

router.post("/memories", async (req, res) => {
  const Body = z.object({
    chatbotId: z.number().int().optional(),
    userId: z.number().int().optional(),
    category: z.string().default("general"),
    content: z.string().min(1),
    importance: z.number().min(0).max(1).default(0.5),
    source: z.string().default("manual"),
    tags: z.array(z.string()).default([]),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.insert(aiBrainMemories).values(parsed.data).returning();
  res.status(201).json(row);
});

router.patch("/memories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const Body = z.object({
    content: z.string().optional(),
    importance: z.number().min(0).max(1).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(aiBrainMemories).set({ ...parsed.data, updatedAt: new Date() }).where(eq(aiBrainMemories.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/memories/:id", async (req, res) => {
  await db.delete(aiBrainMemories).where(eq(aiBrainMemories.id, Number(req.params.id)));
  res.status(204).end();
});

/* ─── Compress memories ─── */
router.post("/compress", async (req, res) => {
  const { chatbotId } = req.body as { chatbotId?: number };

  const oldMemories = await db.select().from(aiBrainMemories)
    .where(chatbotId ? eq(aiBrainMemories.chatbotId, chatbotId) : sql`true`)
    .orderBy(asc(aiBrainMemories.importance), asc(aiBrainMemories.createdAt))
    .limit(100);

  if (oldMemories.length < 20) {
    res.json({ ok: true, compressed: 0, message: "Không đủ bộ nhớ để nén" }); return;
  }

  const memText = oldMemories.map((m, i) => `[${i + 1}] [${m.category}] ${m.content}`).join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Bạn là AI tổng hợp bộ nhớ. Hãy nén và tổng hợp các ký ức sau thành tối đa 10 ký ức quan trọng nhất, loại bỏ trùng lặp, giữ lại thông tin có giá trị cao. Trả về JSON array, mỗi item có: {"category": string, "content": string, "importance": 0.0-1.0, "tags": []}

BỘ NHỚ CẦN NÉN:
${memText}

Trả về CHỈ JSON array, không giải thích thêm.`,
      }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { res.json({ ok: false, message: "AI không trả về JSON hợp lệ" }); return; }

    const compressed = JSON.parse(jsonMatch[0]) as Array<{
      category: string; content: string; importance: number; tags: string[];
    }>;

    const idsToDelete = oldMemories.map(m => m.id);
    for (const id of idsToDelete) {
      await db.delete(aiBrainMemories).where(eq(aiBrainMemories.id, id));
    }

    const inserted = [];
    for (const mem of compressed) {
      const [row] = await db.insert(aiBrainMemories).values({
        chatbotId: chatbotId ?? undefined,
        category: mem.category ?? "compressed",
        content: mem.content,
        importance: mem.importance ?? 0.7,
        source: "compressed",
        isCompressed: true,
        tags: mem.tags ?? [],
      }).returning();
      inserted.push(row);
    }

    res.json({ ok: true, compressed: idsToDelete.length, created: inserted.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* ─── Daily reports ─── */
router.get("/reports", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 30), 100);
  const rows = await db.select().from(dailyReports)
    .orderBy(desc(dailyReports.createdAt)).limit(limit);
  const unread = rows.filter(r => !r.isRead).length;
  res.json({ reports: rows, unread });
});

router.post("/reports/read-all", async (_req, res) => {
  await db.update(dailyReports).set({ isRead: true }).where(eq(dailyReports.isRead, false));
  res.json({ ok: true });
});

router.post("/reports/generate", async (req, res) => {
  const { chatbotId } = req.body as { chatbotId?: number };
  const today = new Date().toISOString().slice(0, 10);

  const memories = await db.select().from(aiBrainMemories)
    .where(chatbotId ? eq(aiBrainMemories.chatbotId, chatbotId) : sql`true`)
    .orderBy(desc(aiBrainMemories.createdAt)).limit(50);

  const [memCount] = await db.select({ value: count() }).from(aiBrainMemories);

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Tạo báo cáo hàng ngày cho AI Agent của SmartHomeQ. Ngày: ${today}. 
Tổng bộ nhớ: ${memCount.value} entries. Các ký ức gần nhất: ${memories.slice(0, 10).map(m => m.content).join("; ")}

Trả về JSON: {"summary": "tóm tắt ngắn", "stats": {"total_memories": ${memCount.value}}, "actions": ["hành động đã làm"], "suggestions": ["đề xuất cải thiện"]}
Chỉ trả về JSON.`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const reportData = jsonMatch ? JSON.parse(jsonMatch[0]) as {
      summary?: string; stats?: Record<string, unknown>;
      actions?: string[]; suggestions?: string[];
    } : {};

    const [report] = await db.insert(dailyReports).values({
      chatbotId: chatbotId ?? undefined,
      reportDate: today,
      summary: reportData.summary ?? "Báo cáo tự động",
      stats: reportData.stats ?? { total_memories: memCount.value },
      actions: reportData.actions ?? [],
      suggestions: reportData.suggestions ?? [],
    }).returning();

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* ─── Scan (manual trigger) ─── */
router.post("/scan", async (req, res) => {
  const { chatbotId } = req.body as { chatbotId?: number };

  const [cfg] = await db.select().from(aiBrainConfig)
    .where(chatbotId ? eq(aiBrainConfig.chatbotId, chatbotId) : sql`true`);

  if (!cfg) { res.status(404).json({ error: "Chưa có cấu hình AI Brain" }); return; }

  const [memCount] = await db.select({ value: count() }).from(aiBrainMemories)
    .where(chatbotId ? eq(aiBrainMemories.chatbotId, chatbotId) : sql`true`);

  const now = new Date();
  const nextScan = new Date(now.getTime() + cfg.scanIntervalMinutes * 60 * 1000);

  await db.update(aiBrainConfig).set({ lastScanAt: now, nextScanAt: nextScan, updatedAt: now })
    .where(eq(aiBrainConfig.id, cfg.id));

  const suggestions: string[] = [];
  if (memCount.value >= (cfg.compressionThreshold ?? 400)) {
    suggestions.push(`Bộ nhớ đã đạt ${memCount.value}/${cfg.maxMemories} entries — nên nén bộ nhớ`);
  }
  if (!cfg.isAutoEnabled) {
    suggestions.push("Bật chế độ AUTO để AI tự động học và đề xuất");
  }

  res.json({
    ok: true,
    scannedAt: now,
    nextScanAt: nextScan,
    memoryCount: memCount.value,
    suggestions,
  });
});

export default router;
