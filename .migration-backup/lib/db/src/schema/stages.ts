import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const stagesTable = pgTable("stages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  color: text("color").notNull().default("#64748b"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StageRow = typeof stagesTable.$inferSelect;
