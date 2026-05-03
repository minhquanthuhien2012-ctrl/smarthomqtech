import { Router } from "express";
import { db } from "@workspace/db";
import { chatbots } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const ChatbotBody = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  systemPrompt: z.string().default(""),
  model: z.string().default("claude-sonnet-4-6"),
  tools: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

router.get("/", async (_req, res) => {
  const result = await db.select().from(chatbots).orderBy(chatbots.createdAt);
  res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = ChatbotBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.insert(chatbots).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(chatbots).where(eq(chatbots.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ChatbotBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(chatbots).set({ ...parsed.data, updatedAt: new Date() }).where(eq(chatbots.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(chatbots).where(eq(chatbots.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
