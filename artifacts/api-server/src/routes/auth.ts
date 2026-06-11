import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users, userSessions, userChatbots } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "smarthomeq-secret-2024";
const TOKEN_TTL_DAYS = 30;

function makeToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: `${TOKEN_TTL_DAYS}d` });
}

function tokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TOKEN_TTL_DAYS);
  return d;
}

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().default(""),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const GoogleBody = z.object({
  googleId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().default(""),
  avatarUrl: z.string().default(""),
});

async function createSession(userId: number) {
  const token = makeToken(userId);
  await db.insert(userSessions).values({ userId, token, expiresAt: tokenExpiry() });
  return token;
}

async function createDefaultChatbot(userId: number) {
  const existing = await db.select().from(userChatbots).where(eq(userChatbots.userId, userId));
  if (existing.length === 0) {
    await db.insert(userChatbots).values({ userId, aiName: "AI cá nhân", systemPrompt: "", model: "claude-sonnet-4-6" });
  }
}

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Email/mật khẩu không hợp lệ" }); return; }
  const { email, password, displayName } = parsed.data;

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing.length > 0) { res.status(409).json({ error: "Email đã được sử dụng" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(), passwordHash,
    displayName: displayName || email.split("@")[0],
  }).returning();

  await createDefaultChatbot(user.id);
  const token = await createSession(user.id);
  res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role } });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Thông tin đăng nhập không hợp lệ" }); return; }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!user || !user.passwordHash) { res.status(401).json({ error: "Email hoặc mật khẩu không đúng" }); return; }
  if (!user.isActive) { res.status(403).json({ error: "Tài khoản đã bị khoá" }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Email hoặc mật khẩu không đúng" }); return; }

  const token = await createSession(user.id);
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role } });
});

router.post("/google", async (req, res) => {
  const parsed = GoogleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid Google data" }); return; }
  const { googleId, email, displayName, avatarUrl } = parsed.data;

  let [user] = await db.select().from(users).where(eq(users.googleId, googleId));
  if (!user) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (byEmail) {
      [user] = await db.update(users).set({ googleId, avatarUrl: avatarUrl || byEmail.avatarUrl, updatedAt: new Date() }).where(eq(users.id, byEmail.id)).returning();
    } else {
      [user] = await db.insert(users).values({
        email: email.toLowerCase(), googleId, displayName: displayName || email.split("@")[0], avatarUrl,
      }).returning();
    }
  }
  if (!user.isActive) { res.status(403).json({ error: "Tài khoản đã bị khoá" }); return; }

  await createDefaultChatbot(user.id);
  const token = await createSession(user.id);
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role } });
});

router.get("/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Chưa đăng nhập" }); return; }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
    if (!user || !user.isActive) { res.status(401).json({ error: "Phiên đăng nhập hết hạn" }); return; }
    res.json({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role });
  } catch {
    res.status(401).json({ error: "Token không hợp lệ" });
  }
});

router.post("/logout", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    await db.delete(userSessions).where(eq(userSessions.token, token)).catch(() => {});
  }
  res.json({ ok: true });
});

export default router;
