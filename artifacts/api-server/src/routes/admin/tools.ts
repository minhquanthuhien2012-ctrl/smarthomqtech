import { Router } from "express";
import { db } from "@workspace/db";
import { tools } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const ToolBody = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  inputSchema: z.record(z.unknown()).default({}),
  implementation: z.string().default(""),
  isBuiltin: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

router.get("/", async (_req, res) => {
  const result = await db.select().from(tools).orderBy(tools.createdAt);
  res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = ToolBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.insert(tools).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(tools).where(eq(tools.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ToolBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(tools).set({ ...parsed.data, updatedAt: new Date() }).where(eq(tools.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(tools).where(eq(tools.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
