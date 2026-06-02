import { Router } from "express";
import { db, mcPaymentsTable, mcNotificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

router.get("/mc/payments", async (_req, res) => {
  const rows = await db.select().from(mcPaymentsTable);
  res.json(rows);
});

router.post("/mc/payments", async (req, res) => {
  const body = req.body as typeof mcPaymentsTable.$inferInsert;
  if (!body.id || !body.userId || !body.month) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const [created] = await db.insert(mcPaymentsTable).values({
    ...body,
    paymentMethod: body.paymentMethod ?? null,
    proofFileName: body.proofFileName ?? null, proofDataUrl: body.proofDataUrl ?? null,
    uploadedAt: body.uploadedAt ?? null, verifiedAt: body.verifiedAt ?? null, notes: body.notes ?? null,
  }).returning();
  res.status(201).json(created);
});

router.post("/mc/payments/batch", async (req, res) => {
  const rows = req.body as (typeof mcPaymentsTable.$inferInsert)[];
  if (!rows?.length) { res.json([]); return; }
  const created = await db.insert(mcPaymentsTable).values(rows.map((r) => ({
    ...r, proofFileName: r.proofFileName ?? null, proofDataUrl: r.proofDataUrl ?? null,
    uploadedAt: r.uploadedAt ?? null, verifiedAt: r.verifiedAt ?? null, notes: r.notes ?? null,
  }))).returning();
  res.status(201).json(created);
});

router.put("/mc/payments/:id", async (req, res) => {
  const body = req.body as Partial<typeof mcPaymentsTable.$inferInsert> & {
    notification?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number };
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  const { notification, notifications, ...updates } = body;
  const [updated] = await db.update(mcPaymentsTable).set({
    ...updates,
    paymentMethod: updates.paymentMethod ?? null,
    proofFileName: updates.proofFileName ?? null, proofDataUrl: updates.proofDataUrl ?? null,
    uploadedAt: updates.uploadedAt ?? null, verifiedAt: updates.verifiedAt ?? null, notes: updates.notes ?? null,
  }).where(eq(mcPaymentsTable.id, req.params.id)).returning();
  if (!updated) { res.status(404).json({ error: "Pembayaran tidak ditemukan." }); return; }
  const notifRows = [
    ...(notification ? [{ ...notification, link: notification.link ?? null, read: false }] : []),
    ...(notifications?.map((n) => ({ ...n, link: n.link ?? null, read: false })) ?? []),
  ];
  if (notifRows.length) await db.insert(mcNotificationsTable).values(notifRows);
  res.json(updated);
});

export default router;
