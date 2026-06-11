import { pgTable, serial, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  displayName: text("display_name").notNull().default(""),
  avatarUrl: text("avatar_url").notNull().default(""),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userChatbots = pgTable("user_chatbots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  aiName: text("ai_name").notNull().default("AI cá nhân"),
  systemPrompt: text("system_prompt").notNull().default(""),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  enabledTools: jsonb("enabled_tools").notNull().default([]),
  enabledSkills: jsonb("enabled_skills").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userConnections = pgTable("user_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull().default(""),
  config: jsonb("config").notNull().default({}),
  status: text("status").notNull().default("disconnected"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserChatbotSchema = createInsertSchema(userChatbots).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserConnectionSchema = createInsertSchema(userConnections).omit({ id: true, createdAt: true, updatedAt: true });

export type User = typeof users.$inferSelect;
export type UserChatbot = typeof userChatbots.$inferSelect;
export type UserConnection = typeof userConnections.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
