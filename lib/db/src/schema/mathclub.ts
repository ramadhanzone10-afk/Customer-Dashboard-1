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

export type McUserRow = typeof mcUsersTable.$inferSelect;
export type McUserInsert = typeof mcUsersTable.$inferInsert;
