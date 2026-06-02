import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const contactsTable = pgTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  affiliation: text("affiliation"),
  email: text("email"),
  phone: text("phone"),
  stageId: text("stage_id"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContactRow = typeof contactsTable.$inferSelect;
