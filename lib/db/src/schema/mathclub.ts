import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const mcUsersTable = pgTable("mc_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatarColor: text("avatar_color"),
  kelas: text("kelas"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mcSettingsTable = pgTable("mc_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const mcClassMessagesTable = pgTable("mc_class_messages", {
  id: text("id").primaryKey(),
  kelas: text("kelas").notNull(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type McUserRow = typeof mcUsersTable.$inferSelect;
export type McUserInsert = typeof mcUsersTable.$inferInsert;
export type McClassMessageRow = typeof mcClassMessagesTable.$inferSelect;
