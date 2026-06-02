import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const interactionsTable = pgTable("interactions", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InteractionRow = typeof interactionsTable.$inferSelect;
