import { Router } from "express";
import { db, mcNotificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/mc/notifications/:userId", async (req, res) => {
  const rows = await db.select().from(mcNotificationsTable)
    .where(eq(mcNotificationsTable.userId, req.params.userId));
  res.json(rows);
});

router.post("/mc/notifications", async (req, res) => {
  const n = req.body as typeof mcNotificationsTable.$inferInsert;
  const [created] = await db.insert(mcNotificationsTable).values({ ...n, link: n.link ?? null, read: false }).returning();
  res.status(201).json(created);
});

router.post("/mc/notifications/batch", async (req, res) => {
  const rows = req.body as (typeof mcNotificationsTable.$inferInsert)[];
  if (!rows?.length) { res.json([]); return; }
  const created = await db.insert(mcNotificationsTable).values(rows.map((n) => ({ ...n, link: n.link ?? null, read: n.read ?? false }))).returning();
  res.status(201).json(created);
});

router.put("/mc/notifications/:id/read", async (req, res) => {
  await db.update(mcNotificationsTable).set({ read: true }).where(eq(mcNotificationsTable.id, req.params.id));
  res.json({ ok: true });
});

router.put("/mc/notifications/read-all/:userId", async (req, res) => {
  await db.update(mcNotificationsTable).set({ read: true }).where(eq(mcNotificationsTable.userId, req.params.userId));
  res.json({ ok: true });
});

export default router;
