import { Router } from "express";
import { db } from "@workspace/db";
import { aiModelConfigs } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

export const ALL_MODELS = [
  // Anthropic
  { provider: "anthropic", modelId: "claude-opus-4-5", label: "Claude Opus 4.5", baseUrl: "" },
  { provider: "anthropic", modelId: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Mặc định)", baseUrl: "" },
  { provider: "anthropic", modelId: "claude-haiku-4-5", label: "Claude Haiku 4.5 (Nhanh)", baseUrl: "" },
  // OpenAI
  { provider: "openai", modelId: "gpt-4o", label: "GPT-4o", baseUrl: "https://api.openai.com/v1" },
  { provider: "openai", modelId: "gpt-4o-mini", label: "GPT-4o Mini", baseUrl: "https://api.openai.com/v1" },
  { provider: "openai", modelId: "gpt-4-turbo", label: "GPT-4 Turbo", baseUrl: "https://api.openai.com/v1" },
  { provider: "openai", modelId: "o1", label: "OpenAI o1 (Reasoning)", baseUrl: "https://api.openai.com/v1" },
  { provider: "openai", modelId: "o3-mini", label: "OpenAI o3 Mini", baseUrl: "https://api.openai.com/v1" },
  // Google Gemini
  { provider: "gemini", modelId: "gemini-2.0-flash", label: "Gemini 2.0 Flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { provider: "gemini", modelId: "gemini-1.5-pro", label: "Gemini 1.5 Pro", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { provider: "gemini", modelId: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Mới nhất)", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  // Groq — production models listed in Groq's current model catalog.
  // Removed deprecated entries: mixtral-8x7b-32768 and deepseek-r1-distill-llama-70b.
  { provider: "groq", modelId: "openai/gpt-oss-120b", label: "GPT OSS 120B (Groq)", baseUrl: "https://api.groq.com/openai/v1" },
  { provider: "groq", modelId: "openai/gpt-oss-20b", label: "GPT OSS 20B (Groq)", baseUrl: "https://api.groq.com/openai/v1" },
  { provider: "groq", modelId: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", baseUrl: "https://api.groq.com/openai/v1" },
  { provider: "groq", modelId: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Groq)", baseUrl: "https://api.groq.com/openai/v1" },
  { provider: "groq", modelId: "groq/compound", label: "Groq Compound (web search + code)", baseUrl: "https://api.groq.com/openai/v1" },
  { provider: "groq", modelId: "groq/compound-mini", label: "Groq Compound Mini (web search + code)", baseUrl: "https://api.groq.com/openai/v1" },
  // Mistral
  { provider: "mistral", modelId: "mistral-large-latest", label: "Mistral Large", baseUrl: "https://api.mistral.ai/v1" },
  { provider: "mistral", modelId: "mistral-small-latest", label: "Mistral Small", baseUrl: "https://api.mistral.ai/v1" },
  { provider: "mistral", modelId: "codestral-latest", label: "Codestral (Code)", baseUrl: "https://api.mistral.ai/v1" },
  // DeepSeek
  { provider: "deepseek", modelId: "deepseek-chat", label: "DeepSeek Chat V3", baseUrl: "https://api.deepseek.com/v1" },
  { provider: "deepseek", modelId: "deepseek-reasoner", label: "DeepSeek Reasoner R1", baseUrl: "https://api.deepseek.com/v1" },
  // xAI
  { provider: "xai", modelId: "grok-2-1212", label: "Grok 2", baseUrl: "https://api.x.ai/v1" },
  { provider: "xai", modelId: "grok-3", label: "Grok 3", baseUrl: "https://api.x.ai/v1" },
  // Cohere
  { provider: "cohere", modelId: "command-r-plus-08-2024", label: "Command R+", baseUrl: "https://api.cohere.com/v1" },
  // Perplexity
  { provider: "perplexity", modelId: "sonar-pro", label: "Perplexity Sonar Pro", baseUrl: "https://api.perplexity.ai" },
  { provider: "perplexity", modelId: "sonar", label: "Perplexity Sonar", baseUrl: "https://api.perplexity.ai" },
  // Together AI
  { provider: "together", modelId: "meta-llama/Llama-3-70b-chat-hf", label: "Llama 3 70B (Together)", baseUrl: "https://api.together.xyz/v1" },
  { provider: "together", modelId: "Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen 2.5 72B (Together)", baseUrl: "https://api.together.xyz/v1" },
  // Ollama (local)
  { provider: "ollama", modelId: "llama3.2", label: "Llama 3.2 (Ollama Local)", baseUrl: "http://localhost:11434/v1" },
  { provider: "ollama", modelId: "qwen2.5", label: "Qwen 2.5 (Ollama Local)", baseUrl: "http://localhost:11434/v1" },
];

router.get("/catalog", (_req, res) => {
  res.json(ALL_MODELS);
});

router.get("/", async (_req, res) => {
  const rows = await db.select().from(aiModelConfigs).orderBy(aiModelConfigs.provider, aiModelConfigs.modelId);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const Body = z.object({
    provider: z.string().min(1),
    modelId: z.string().min(1),
    label: z.string().min(1),
    apiKey: z.string().default(""),
    baseUrl: z.string().default(""),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  if (parsed.data.isDefault) {
    await db.update(aiModelConfigs).set({ isDefault: false });
  }

  const existing = await db.select().from(aiModelConfigs)
    .where(eq(aiModelConfigs.modelId, parsed.data.modelId));
  if (existing.length > 0) {
    const [row] = await db.update(aiModelConfigs)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(aiModelConfigs.modelId, parsed.data.modelId)).returning();
    res.json(row); return;
  }

  const [row] = await db.insert(aiModelConfigs).values(parsed.data).returning();
  res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const Body = z.object({
    apiKey: z.string().optional(),
    label: z.string().optional(),
    baseUrl: z.string().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  if (parsed.data.isDefault) {
    await db.update(aiModelConfigs).set({ isDefault: false });
  }

  const [row] = await db.update(aiModelConfigs).set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(aiModelConfigs.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  await db.delete(aiModelConfigs).where(eq(aiModelConfigs.id, Number(req.params.id)));
  res.status(204).end();
});

/* ─── Test API key ─── */
router.post("/test", async (req, res) => {
  const Body = z.object({
    provider: z.string(),
    modelId: z.string(),
    apiKey: z.string(),
    baseUrl: z.string().default(""),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const { provider, modelId, apiKey, baseUrl } = parsed.data;

  try {
    if (provider === "anthropic") {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model: modelId,
        max_tokens: 32,
        messages: [{ role: "user", content: "Say: OK" }],
      });
      const text = resp.content[0].type === "text" ? resp.content[0].text : "";
      res.json({ ok: true, response: text.slice(0, 100) }); return;
    }

    // OpenAI-compatible providers
    const endpoint = baseUrl || "https://api.openai.com/v1";
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 32,
        messages: [{ role: "user", content: "Say: OK" }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.json({ ok: false, response: `HTTP ${response.status}: ${errText.slice(0, 200)}` }); return;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message: string };
    };
    if (data.error) { res.json({ ok: false, response: data.error.message }); return; }
    const text = data.choices?.[0]?.message?.content ?? "OK";

    await db.update(aiModelConfigs)
      .set({ lastTestAt: new Date(), lastTestOk: true })
      .where(eq(aiModelConfigs.modelId, modelId));

    res.json({ ok: true, response: text.slice(0, 100) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(aiModelConfigs)
      .set({ lastTestAt: new Date(), lastTestOk: false })
      .where(eq(aiModelConfigs.modelId, modelId)).catch(() => {});
    res.json({ ok: false, response: msg.slice(0, 200) });
  }
});

export default router;
