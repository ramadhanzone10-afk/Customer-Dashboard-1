import { Router, type IRouter } from "express";
import { db, contactsTable, stagesTable, interactionsTable } from "@workspace/db";
import { sql, desc, gte, eq } from "drizzle-orm";
import { RecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tags", async (_req, res) => {
  const rows = await db
    .select({
      tag: sql<string>`jsonb_array_elements_text(${contactsTable.tags})`.as("tag"),
    })
    .from(contactsTable);
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.tag, (counts.get(r.tag) ?? 0) + 1);
  }
  const out = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  res.json(out);
});

router.get("/stats/summary", async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const totalRow = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(contactsTable);
  const weekContacts = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(contactsTable)
    .where(gte(contactsTable.createdAt, weekAgo));
  const weekInteractions = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(interactionsTable)
    .where(gte(interactionsTable.createdAt, weekAgo));

  const stages = await db.select().from(stagesTable).orderBy(stagesTable.position);
  const byStage = await Promise.all(
    stages.map(async (s) => {
      const [r] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(contactsTable)
        .where(eq(contactsTable.stageId, s.id));
      return { stageId: s.id, stageName: s.name, count: r?.count ?? 0 };
    })
  );

  res.json({
    totalContacts: totalRow[0]?.count ?? 0,
    contactsThisWeek: weekContacts[0]?.count ?? 0,
    interactionsThisWeek: weekInteractions[0]?.count ?? 0,
    byStage,
  });
});

router.get("/activity/recent", async (req, res) => {
  const q = RecentActivityQueryParams.parse(req.query);
  const limit = q.limit ?? 20;
  const rows = await db
    .select({
      id: interactionsTable.id,
      contactId: interactionsTable.contactId,
      contactName: contactsTable.name,
      kind: interactionsTable.kind,
      body: interactionsTable.body,
      occurredAt: interactionsTable.occurredAt,
    })
    .from(interactionsTable)
    .leftJoin(contactsTable, eq(contactsTable.id, interactionsTable.contactId))
    .orderBy(desc(interactionsTable.occurredAt))
    .limit(limit);
  res.json(
    rows.map((r) => ({
      ...r,
      contactName: r.contactName ?? "Unknown",
    }))
  );
});

export default router;
