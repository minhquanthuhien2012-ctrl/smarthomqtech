import { pgTable, serial, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scrapedSites = pgTable("scraped_sites", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull().default(""),
  type: text("type").notNull().default("unknown"),
  role: text("role").notNull().default("primary"),
  credentials: jsonb("credentials").notNull().default({}),
  categories: jsonb("categories").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scrapedItems = pgTable("scraped_items", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  itemType: text("item_type").notNull().default("product"),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  originalUrl: text("original_url").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  price: text("price").notNull().default(""),
  category: text("category").notNull().default(""),
  rawData: jsonb("raw_data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contentTemplates = pgTable("content_templates", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  name: text("name").notNull().default(""),
  templateType: text("template_type").notNull().default("product"),
  template: text("template").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const draftPosts = pgTable("draft_posts", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  targetCategory: text("target_category").notNull().default(""),
  status: text("status").notNull().default("pending"),
  postType: text("post_type").notNull().default("post"),
  publishedUrl: text("published_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const toolRequests = pgTable("tool_requests", {
  id: serial("id").primaryKey(),
  userIdentifier: text("user_identifier").notNull().default(""),
  toolName: text("tool_name").notNull().default(""),
  requestType: text("request_type").notNull().default("tool"),
  status: text("status").notNull().default("pending"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertScrapedSiteSchema = createInsertSchema(scrapedSites).omit({ id: true, createdAt: true, updatedAt: true, lastScrapedAt: true });
export const insertScrapedItemSchema = createInsertSchema(scrapedItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContentTemplateSchema = createInsertSchema(contentTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDraftPostSchema = createInsertSchema(draftPosts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertToolRequestSchema = createInsertSchema(toolRequests).omit({ id: true, createdAt: true, updatedAt: true });

export type ScrapedSite = typeof scrapedSites.$inferSelect;
export type ScrapedItem = typeof scrapedItems.$inferSelect;
export type ContentTemplate = typeof contentTemplates.$inferSelect;
export type DraftPost = typeof draftPosts.$inferSelect;
export type ToolRequest = typeof toolRequests.$inferSelect;
export type InsertScrapedSite = z.infer<typeof insertScrapedSiteSchema>;
export type InsertScrapedItem = z.infer<typeof insertScrapedItemSchema>;
export type InsertContentTemplate = z.infer<typeof insertContentTemplateSchema>;
export type InsertDraftPost = z.infer<typeof insertDraftPostSchema>;
export type InsertToolRequest = z.infer<typeof insertToolRequestSchema>;
