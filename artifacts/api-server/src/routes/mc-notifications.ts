import { Router } from "express";
import { db, mcNotificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireTeacher } from "../lib/auth";

const router = Router();

// Read own notifications only
router.get("/mc/notifications/:userId", requireAuth, async (req, res) => {
  const requestedId = req.params.userId;
  if (req.jwtUser!.role !== "teacher" && req.jwtUser!.userId !== requestedId) {
    res.status(403).json({ error: "Tidak dapat mengakses notifikasi milik pengguna lain." });
    return;
  }
  const rows = await db.select().from(mcNotificationsTable)
    .where(eq(mcNotificationsTable.userId, requestedId));
  res.json(rows);
});

// Create notifications: teacher only (system-generated)
router.post("/mc/notifications", requireTeacher, async (req, res) => {
  const n = req.body as typeof mcNotificationsTable.$inferInsert;
  const [created] = await db.insert(mcNotificationsTable).values({ ...n, link: n.link ?? null, read: false }).returning();
  res.status(201).json(created);
});

router.post("/mc/notifications/batch", requireTeacher, async (req, res) => {
  const rows = req.body as (typeof mcNotificationsTable.$inferInsert)[];
  if (!rows?.length) { res.json([]); return; }
  const created = await db.insert(mcNotificationsTable).values(rows.map((n) => ({ ...n, link: n.link ?? null, read: n.read ?? false }))).returning();
  res.status(201).json(created);
});

// Mark own notification as read
router.put("/mc/notifications/:id/read", requireAuth, async (req, res) => {
  const [existing] = await db.select().from(mcNotificationsTable).where(eq(mcNotificationsTable.id, req.params.id));
  if (!existing) { res.status(404).json({ error: "Notifikasi tidak ditemukan." }); return; }
  if (req.jwtUser!.role !== "teacher" && existing.userId !== req.jwtUser!.userId) {
    res.status(403).json({ error: "Tidak dapat menandai notifikasi milik pengguna lain." });
    return;
  }
  await db.update(mcNotificationsTable).set({ read: true }).where(eq(mcNotificationsTable.id, req.params.id));
  res.json({ ok: true });
});

// Mark all own notifications as read
router.put("/mc/notifications/read-all/:userId", requireAuth, async (req, res) => {
  const requestedId = req.params.userId;
  if (req.jwtUser!.role !== "teacher" && req.jwtUser!.userId !== requestedId) {
    res.status(403).json({ error: "Tidak dapat menandai notifikasi milik pengguna lain." });
    return;
  }
  await db.update(mcNotificationsTable).set({ read: true }).where(eq(mcNotificationsTable.userId, requestedId));
  res.json({ ok: true });
});

export default router;
