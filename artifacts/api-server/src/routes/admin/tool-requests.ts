import { Router } from "express";
import { db } from "@workspace/db";
import { toolRequests } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const RequestBody = z.object({
  userIdentifier: z.string().min(1),
  toolName: z.string().min(1),
  requestType: z.enum(["tool", "skill"]).default("tool"),
  note: z.string().default(""),
});

const StatusBody = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  note: z.string().optional(),
});

router.get("/", async (_req, res) => {
  const rows = await db.select().from(toolRequests).orderBy(desc(toolRequests.createdAt));
  res.json(rows);
});

router.get("/my", async (req, res) => {
  const uid = req.query.userIdentifier as string;
  if (!uid) { res.status(400).json({ error: "userIdentifier required" }); return; }
  const rows = await db.select().from(toolRequests)
    .where(eq(toolRequests.userIdentifier, uid))
    .orderBy(desc(toolRequests.createdAt));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = RequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const existing = await db.select().from(toolRequests)
    .where(eq(toolRequests.userIdentifier, parsed.data.userIdentifier));
  const dup = existing.find(r => r.toolName === parsed.data.toolName && r.requestType === parsed.data.requestType);
  if (dup) { res.json(dup); return; }

  const [row] = await db.insert(toolRequests).values(parsed.data).returning();
  res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = StatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(toolRequests)
    .set({ status: parsed.data.status, note: parsed.data.note ?? "", updatedAt: new Date() })
    .where(eq(toolRequests.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(toolRequests).where(eq(toolRequests.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
