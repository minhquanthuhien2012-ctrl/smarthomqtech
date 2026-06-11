import { Router } from "express";
import { db } from "@workspace/db";
import { users, userChatbots, userConnections, toolRequests } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select({
    id: users.id, email: users.email, displayName: users.displayName,
    avatarUrl: users.avatarUrl, phone: users.phone, role: users.role,
    isActive: users.isActive, createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.select({
    id: users.id, email: users.email, displayName: users.displayName,
    avatarUrl: users.avatarUrl, phone: users.phone, role: users.role,
    isActive: users.isActive, createdAt: users.createdAt,
  }).from(users).where(eq(users.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const [chatbot] = await db.select().from(userChatbots).where(eq(userChatbots.userId, id));
  const connections = await db.select().from(userConnections).where(eq(userConnections.userId, id));
  const requests = await db.select().from(toolRequests).where(eq(toolRequests.userIdentifier, String(id)));

  res.json({ user, chatbot: chatbot ?? null, connections, toolRequests: requests });
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const Body = z.object({
    displayName: z.string().optional(),
    phone: z.string().optional(),
    role: z.enum(["user", "admin"]).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.displayName !== undefined) update.displayName = parsed.data.displayName;
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
  if (parsed.data.role !== undefined) update.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;
  if (parsed.data.password) update.passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [row] = await db.update(users).set(update).where(eq(users.id, id)).returning({
    id: users.id, email: users.email, displayName: users.displayName, role: users.role, isActive: users.isActive,
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(users).where(eq(users.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
