import { Router } from "express";
import { db } from "@workspace/db";
import { scrapedSites, scrapedItems, contentTemplates, draftPosts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

const SiteBody = z.object({
  url: z.string().url(),
  name: z.string().default(""),
  role: z.enum(["primary", "secondary"]).default("primary"),
  credentials: z.record(z.unknown()).default({}),
});

const ItemBody = z.object({
  title: z.string().default(""),
  content: z.string().default(""),
  originalUrl: z.string().default(""),
  imageUrl: z.string().default(""),
  price: z.string().default(""),
  category: z.string().default(""),
});

const DraftBody = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  targetCategory: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "published"]).optional(),
  publishedUrl: z.string().optional(),
});

async function fetchUrl(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SmartHomeQ-Bot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

router.get("/sites", async (_req, res) => {
  const rows = await db.select().from(scrapedSites).orderBy(scrapedSites.createdAt);
  res.json(rows);
});

router.post("/sites", async (req, res) => {
  const parsed = SiteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.insert(scrapedSites).values({ ...parsed.data, type: "unknown" }).returning();
  res.status(201).json(row);
});

router.put("/sites/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = SiteBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(scrapedSites).set({ ...parsed.data, updatedAt: new Date() }).where(eq(scrapedSites.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/sites/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(scrapedItems).where(eq(scrapedItems.siteId, id));
  await db.delete(contentTemplates).where(eq(contentTemplates.siteId, id));
  const deleted = await db.delete(scrapedSites).where(eq(scrapedSites.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.post("/sites/:id/analyze", async (req, res) => {
  const id = Number(req.params.id);
  const [site] = await db.select().from(scrapedSites).where(eq(scrapedSites.id, id));
  if (!site) { res.status(404).json({ error: "Not found" }); return; }

  try {
    const html = await fetchUrl(site.url);
    const text = stripHtml(html);

    const resp = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Phân tích trang web sau và trả về JSON với cấu trúc:
{
  "type": "woocommerce|shopify|blogger|wordpress|news|unknown",
  "name": "tên web",
  "categories": [{"name": "tên danh mục", "url": "link danh mục"}],
  "description": "mô tả ngắn"
}

URL: ${site.url}
Nội dung trang: ${text}

CHỈ trả về JSON, không giải thích thêm.`,
      }],
    });

    const raw = resp.content[0].type === "text" ? resp.content[0].text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) as { type?: string; name?: string; categories?: unknown[]; description?: string } : {};

    const [updated] = await db.update(scrapedSites).set({
      type: (parsed.type as string) ?? "unknown",
      name: (parsed.name as string) || site.name || site.url,
      categories: (parsed.categories as unknown[]) ?? [],
      updatedAt: new Date(),
    }).where(eq(scrapedSites.id, id)).returning();

    res.json({ site: updated, analysis: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.post("/sites/:id/scrape", async (req, res) => {
  const id = Number(req.params.id);
  const { categoryUrl } = req.body as { categoryUrl?: string };
  const [site] = await db.select().from(scrapedSites).where(eq(scrapedSites.id, id));
  if (!site) { res.status(404).json({ error: "Not found" }); return; }

  const targetUrl = categoryUrl || site.url;

  try {
    const html = await fetchUrl(targetUrl);
    const text = stripHtml(html);
    const credentials = site.credentials as Record<string, string>;

    let aiPrompt = "";

    if (site.type === "woocommerce" && credentials.consumerKey && credentials.consumerSecret) {
      const apiUrl = `${site.url.replace(/\/$/, "")}/wp-json/wc/v3/products?per_page=50&consumer_key=${credentials.consumerKey}&consumer_secret=${credentials.consumerSecret}`;
      try {
        const apiResp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
        if (apiResp.ok) {
          const products = await apiResp.json() as Array<{ name?: string; description?: string; permalink?: string; images?: Array<{ src?: string }>; price?: string; categories?: Array<{ name?: string }> }>;
          const items = products.slice(0, 20).map(p => ({
            siteId: id,
            itemType: "product" as const,
            title: p.name ?? "",
            content: stripHtml(p.description ?? "").slice(0, 2000),
            originalUrl: p.permalink ?? "",
            imageUrl: p.images?.[0]?.src ?? "",
            price: p.price ?? "",
            category: p.categories?.[0]?.name ?? "",
            rawData: p as unknown as Record<string, unknown>,
          }));
          if (items.length > 0) {
            await db.insert(scrapedItems).values(items);
            await db.update(scrapedSites).set({ lastScrapedAt: new Date(), updatedAt: new Date() }).where(eq(scrapedSites.id, id));
          }
          res.json({ count: items.length, items });
          return;
        }
      } catch { /* fallback to HTML scraping */ }
    }

    aiPrompt = `Trích xuất danh sách sản phẩm hoặc bài viết từ trang web này. Trả về JSON array:
[{"title":"tên","price":"giá","url":"link","image":"ảnh","category":"danh mục","description":"mô tả ngắn"}]

URL: ${targetUrl}
Nội dung: ${text}

Chỉ trả về JSON array, không giải thích.`;

    const resp = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: aiPrompt }],
    });

    const raw = resp.content[0].type === "text" ? resp.content[0].text : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) as Array<{ title?: string; price?: string; url?: string; image?: string; category?: string; description?: string }> : [];

    const items = parsed.slice(0, 30).map(p => ({
      siteId: id,
      itemType: "product" as const,
      title: p.title ?? "",
      content: p.description ?? "",
      originalUrl: p.url ?? "",
      imageUrl: p.image ?? "",
      price: p.price ?? "",
      category: p.category ?? "",
      rawData: p as unknown as Record<string, unknown>,
    }));

    if (items.length > 0) {
      await db.insert(scrapedItems).values(items);
      await db.update(scrapedSites).set({ lastScrapedAt: new Date(), updatedAt: new Date() }).where(eq(scrapedSites.id, id));
    }

    res.json({ count: items.length, items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/sites/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(scrapedItems).where(eq(scrapedItems.siteId, id)).orderBy(scrapedItems.createdAt);
  res.json(rows);
});

router.put("/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ItemBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(scrapedItems).set({ ...parsed.data, updatedAt: new Date() }).where(eq(scrapedItems.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(scrapedItems).where(eq(scrapedItems.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.post("/sites/:id/template", async (req, res) => {
  const id = Number(req.params.id);
  const [site] = await db.select().from(scrapedSites).where(eq(scrapedSites.id, id));
  if (!site) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select().from(scrapedItems).where(eq(scrapedItems.siteId, id));
  if (items.length === 0) { res.status(400).json({ error: "Chưa có dữ liệu, hãy scrape trước" }); return; }

  const samples = items.slice(0, 5).map(i => `Tên: ${i.title}\nMô tả: ${i.content.slice(0, 300)}\nGiá: ${i.price}`).join("\n\n---\n\n");

  const resp = await anthropic.messages.create({
    model: "claude-haiku-3-5",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Dựa vào các mẫu sản phẩm/bài viết dưới đây từ website ${site.url}, hãy tạo một template viết bài chuẩn.
Template phải có các placeholder như: {{title}}, {{price}}, {{description}}, {{features}}, {{category}}.
Viết bằng tiếng Việt, phong cách chuyên nghiệp bán hàng.

Mẫu tham khảo:
${samples}

Trả về template dạng văn bản thuần.`,
    }],
  });

  const template = resp.content[0].type === "text" ? resp.content[0].text : "";

  const existing = await db.select().from(contentTemplates).where(eq(contentTemplates.siteId, id));
  if (existing.length > 0) {
    const [updated] = await db.update(contentTemplates).set({ template, updatedAt: new Date() }).where(eq(contentTemplates.siteId, id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(contentTemplates).values({ siteId: id, name: `Template ${site.name || site.url}`, templateType: "product", template }).returning();
    res.json(created);
  }
});

router.get("/sites/:id/template", async (req, res) => {
  const id = Number(req.params.id);
  const [tmpl] = await db.select().from(contentTemplates).where(eq(contentTemplates.siteId, id));
  res.json(tmpl ?? null);
});

router.post("/generate", async (req, res) => {
  const { itemIds, siteId, templateId } = req.body as { itemIds: number[]; siteId: number; templateId?: number };
  if (!itemIds?.length || !siteId) { res.status(400).json({ error: "itemIds và siteId bắt buộc" }); return; }

  const [site] = await db.select().from(scrapedSites).where(eq(scrapedSites.id, siteId));
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }

  let template = "";
  if (templateId) {
    const [tmpl] = await db.select().from(contentTemplates).where(eq(contentTemplates.id, templateId));
    template = tmpl?.template ?? "";
  } else {
    const [tmpl] = await db.select().from(contentTemplates).where(eq(contentTemplates.siteId, siteId));
    template = tmpl?.template ?? "";
  }

  const primarySite = await db.select().from(scrapedSites).where(eq(scrapedSites.role, "primary"));
  const primaryTemplate = primarySite[0] ? await db.select().from(contentTemplates).where(eq(contentTemplates.siteId, primarySite[0].id)) : [];
  const writeTemplate = template || primaryTemplate[0]?.template || "";

  const created: unknown[] = [];
  for (const itemId of itemIds.slice(0, 10)) {
    const [item] = await db.select().from(scrapedItems).where(eq(scrapedItems.id, itemId));
    if (!item) continue;

    const resp = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Viết lại bài sau theo template, bằng tiếng Việt, phong cách chuyên nghiệp bán hàng.
${writeTemplate ? `Template:\n${writeTemplate}\n\n` : ""}Thông tin gốc:
Tên: ${item.title}
Mô tả: ${item.content.slice(0, 1000)}
Giá: ${item.price}
Danh mục: ${item.category}
Link gốc: ${item.originalUrl}

Viết bài hoàn chỉnh, hấp dẫn để đăng lên web.`,
      }],
    });

    const content = resp.content[0].type === "text" ? resp.content[0].text : "";
    const [draft] = await db.insert(draftPosts).values({
      siteId,
      title: item.title,
      content,
      sourceUrl: item.originalUrl,
      targetCategory: item.category,
      status: "pending",
      postType: "post",
    }).returning();
    created.push(draft);
  }

  res.json({ count: created.length, drafts: created });
});

router.get("/drafts", async (_req, res) => {
  const rows = await db.select().from(draftPosts).orderBy(draftPosts.createdAt);
  res.json(rows);
});

router.put("/drafts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = DraftBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const [row] = await db.update(draftPosts).set({ ...parsed.data, updatedAt: new Date() }).where(eq(draftPosts.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/drafts/:id/publish", async (req, res) => {
  const id = Number(req.params.id);
  const { targetCategory, siteId } = req.body as { targetCategory?: string; siteId?: number };

  const [draft] = await db.select().from(draftPosts).where(eq(draftPosts.id, id));
  if (!draft) { res.status(404).json({ error: "Not found" }); return; }

  const siteLookupId = siteId ?? draft.siteId;
  const [site] = await db.select().from(scrapedSites).where(eq(scrapedSites.id, siteLookupId));
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }

  const credentials = site.credentials as Record<string, string>;

  if (site.type === "woocommerce" && credentials.consumerKey && credentials.consumerSecret) {
    try {
      const apiUrl = `${site.url.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
      const authHeader = `Basic ${Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString("base64")}`;
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify({ title: draft.title, content: draft.content, status: "publish" }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`WP API ${resp.status}`);
      const post = await resp.json() as { link?: string };
      const [updated] = await db.update(draftPosts).set({
        status: "published",
        targetCategory: targetCategory ?? draft.targetCategory,
        publishedUrl: post.link ?? "",
        updatedAt: new Date(),
      }).where(eq(draftPosts.id, id)).returning();
      res.json({ success: true, draft: updated, publishedUrl: post.link });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Đăng bài thất bại: ${msg}. Hãy copy nội dung và đăng thủ công.` });
      return;
    }
  }

  const [updated] = await db.update(draftPosts).set({
    status: "approved",
    targetCategory: targetCategory ?? draft.targetCategory,
    updatedAt: new Date(),
  }).where(eq(draftPosts.id, id)).returning();
  res.json({ success: true, draft: updated, note: "Web không phải WooCommerce — đã đánh dấu approved, hãy đăng thủ công." });
});

router.delete("/drafts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(draftPosts).where(eq(draftPosts.id, id)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
