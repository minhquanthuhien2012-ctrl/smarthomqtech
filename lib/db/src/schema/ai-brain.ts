import { pgTable, serial, text, timestamp, boolean, jsonb, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiBrainMemories = pgTable("ai_brain_memories", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id"),
  userId: integer("user_id"),
  category: text("category").notNull().default("general"),
  content: text("content").notNull(),
  importance: real("importance").notNull().default(0.5),
  source: text("source").notNull().default("chat"),
  isCompressed: boolean("is_compressed").notNull().default(false),
  tags: jsonb("tags").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiBrainConfig = pgTable("ai_brain_config", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").unique(),
  isAutoEnabled: boolean("is_auto_enabled").notNull().default(false),
  scanIntervalMinutes: integer("scan_interval_minutes").notNull().default(60),
  maxMemories: integer("max_memories").notNull().default(500),
  compressionThreshold: integer("compression_threshold").notNull().default(400),
  autoLearn: boolean("auto_learn").notNull().default(true),
  autoSuggest: boolean("auto_suggest").notNull().default(true),
  autoAsk: boolean("auto_ask").notNull().default(false),
  lastScanAt: timestamp("last_scan_at", { withTimezone: true }),
  nextScanAt: timestamp("next_scan_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dailyReports = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id"),
  reportDate: text("report_date").notNull(),
  summary: text("summary").notNull(),
  stats: jsonb("stats").notNull().default({}),
  actions: jsonb("actions").notNull().default([]),
  suggestions: jsonb("suggestions").notNull().default([]),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiModelConfigs = pgTable("ai_model_configs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  label: text("label").notNull(),
  apiKey: text("api_key").notNull().default(""),
  baseUrl: text("base_url").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAiBrainMemorySchema = createInsertSchema(aiBrainMemories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiBrainConfigSchema = createInsertSchema(aiBrainConfig).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiModelConfigSchema = createInsertSchema(aiModelConfigs).omit({ id: true, createdAt: true, updatedAt: true });

export type AiBrainMemory = typeof aiBrainMemories.$inferSelect;
export type AiBrainConfig = typeof aiBrainConfig.$inferSelect;
export type DailyReport = typeof dailyReports.$inferSelect;
export type AiModelConfig = typeof aiModelConfigs.$inferSelect;
export type InsertAiBrainMemory = z.infer<typeof insertAiBrainMemorySchema>;
