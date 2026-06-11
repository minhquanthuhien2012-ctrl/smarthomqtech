import { Router } from "express";
import { db } from "@workspace/db";
import { userChatbots, userConnections, toolRequests, users } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/profile", async (req: AuthRequest, res) => {
  const [user] = await db.select({
    id: users.id, email: users.email, displayName: users.displayName,
    avatarUrl: users.avatarUrl, phone: users.phone, role: users.role,
  }).from(users).where(eq(users.id, req.userId!));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.patch("/profile", async (req: AuthRequest, res) => {
  const Body = z.object({
    displayName: z.string().optional(),
    phone: z.string().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(users.id, req.userId!)).returning({
    id: users.id, email: users.email, displayName: users.displayName, phone: users.phone,
  });
  res.json(row);
});

router.get("/chatbot", async (req: AuthRequest, res) => {
  let [chatbot] = await db.select().from(userChatbots).where(eq(userChatbots.userId, req.userId!));
  if (!chatbot) {
    [chatbot] = await db.insert(userChatbots).values({ userId: req.userId!, aiName: "AI cá nhân" }).returning();
  }
  res.json(chatbot);
});

router.patch("/chatbot", async (req: AuthRequest, res) => {
  const Body = z.object({
    aiName: z.string().optional(),
    systemPrompt: z.string().optional(),
    model: z.string().optional(),
    enabledTools: z.array(z.string()).optional(),
    enabledSkills: z.array(z.string()).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const existing = await db.select().from(userChatbots).where(eq(userChatbots.userId, req.userId!));
  if (existing.length === 0) {
    const [row] = await db.insert(userChatbots).values({ userId: req.userId!, ...parsed.data }).returning();
    res.json(row); return;
  }
  const [row] = await db.update(userChatbots).set({ ...parsed.data, updatedAt: new Date() }).where(eq(userChatbots.userId, req.userId!)).returning();
  res.json(row);
});

router.get("/connections", async (req: AuthRequest, res) => {
  const rows = await db.select().from(userConnections).where(eq(userConnections.userId, req.userId!)).orderBy(desc(userConnections.createdAt));
  res.json(rows);
});

router.post("/connections", async (req: AuthRequest, res) => {
  const Body = z.object({
    type: z.enum(["zalo", "telegram", "facebook", "xiaozhi"]),
    name: z.string().default(""),
    config: z.record(z.unknown()).default({}),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.insert(userConnections).values({ userId: req.userId!, ...parsed.data }).returning();
  res.status(201).json(row);
});

router.put("/connections/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const Body = z.object({
    name: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    status: z.string().optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(userConnections).set({ ...parsed.data, updatedAt: new Date() }).where(eq(userConnections.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/connections/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(userConnections).where(eq(userConnections.id, id));
  res.status(204).end();
});

router.get("/tool-requests", async (req: AuthRequest, res) => {
  const rows = await db.select().from(toolRequests)
    .where(eq(toolRequests.userIdentifier, String(req.userId!)))
    .orderBy(desc(toolRequests.createdAt));
  res.json(rows);
});

router.post("/tool-requests", async (req: AuthRequest, res) => {
  const Body = z.object({
    toolName: z.string().min(1),
    requestType: z.enum(["tool", "skill"]).default("tool"),
    note: z.string().default(""),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const userIdentifier = String(req.userId!);
  const existing = await db.select().from(toolRequests).where(eq(toolRequests.userIdentifier, userIdentifier));
  const dup = existing.find(r => r.toolName === parsed.data.toolName && r.requestType === parsed.data.requestType);
  if (dup) { res.json(dup); return; }

  const [row] = await db.insert(toolRequests).values({ ...parsed.data, userIdentifier }).returning();
  res.status(201).json(row);
});

export default router;
