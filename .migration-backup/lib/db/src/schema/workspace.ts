import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const workspaceTable = pgTable("workspace", {
  id: text("id").primaryKey(),
  initialized: boolean("initialized").notNull().default(false),
  relationshipType: text("relationship_type").notNull().default("custom"),
  entityLabel: text("entity_label").notNull().default("Contact"),
  entityLabelPlural: text("entity_label_plural").notNull().default("Contacts"),
  affiliationLabel: text("affiliation_label").notNull().default("Company"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkspaceRow = typeof workspaceTable.$inferSelect;
