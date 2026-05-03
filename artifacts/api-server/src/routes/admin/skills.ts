import { Router } from "express";
import { db } from "@workspace/db";
import { skills } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const SkillBody = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  trigger: z.string().default(""),
  actions: z.array(z.record(z.unknown())).default([]),
  isActive: z.boolean().default(true),
});

router.get("/", async (_req, res) => {
  const result = await db.select().from(skills).orderBy(skills.createdAt);
  res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = SkillBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.insert(skills).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(skills).where(eq(skills.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = SkillBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(skills).set({ ...parsed.data, updatedAt: new Date() }).where(eq(skills.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(skills).where(eq(skills.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
