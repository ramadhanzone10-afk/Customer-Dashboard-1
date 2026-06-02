import { Router } from "express";
import { db, mcPaymentsTable, mcNotificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireTeacher } from "../lib/auth";

const router = Router();

// Read: teachers see all; students see their own only
router.get("/mc/payments", requireAuth, async (req, res) => {
  const rows = await db.select().from(mcPaymentsTable);
  if (req.jwtUser!.role === "teacher") {
    res.json(rows);
  } else {
    res.json(rows.filter((r) => r.userId === req.jwtUser!.userId));
  }
});

// Create payment record: teacher creates for students; student can create own payment upload
router.post("/mc/payments", requireAuth, async (req, res) => {
  const body = req.body as typeof mcPaymentsTable.$inferInsert;
  if (!body.id || !body.userId || !body.month) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  if (req.jwtUser!.role === "student" && body.userId !== req.jwtUser!.userId) {
    res.status(403).json({ error: "Tidak dapat membuat pembayaran atas nama siswa lain." });
    return;
  }
  const [created] = await db.insert(mcPaymentsTable).values({
    ...body,
    paymentMethod: body.paymentMethod ?? null,
    proofFileName: body.proofFileName ?? null, proofDataUrl: body.proofDataUrl ?? null,
    uploadedAt: body.uploadedAt ?? null, verifiedAt: body.verifiedAt ?? null, notes: body.notes ?? null,
  }).returning();
  res.status(201).json(created);
});

// Batch create: teacher only (seeding / bulk generation)
router.post("/mc/payments/batch", requireTeacher, async (req, res) => {
  const rows = req.body as (typeof mcPaymentsTable.$inferInsert)[];
  if (!rows?.length) { res.json([]); return; }
  const created = await db.insert(mcPaymentsTable).values(rows.map((r) => ({
    ...r, proofFileName: r.proofFileName ?? null, proofDataUrl: r.proofDataUrl ?? null,
    uploadedAt: r.uploadedAt ?? null, verifiedAt: r.verifiedAt ?? null, notes: r.notes ?? null,
  }))).returning();
  res.status(201).json(created);
});

// Update payment: teachers can update anything; students can only upload proof on their own payment
router.put("/mc/payments/:id", requireAuth, async (req, res) => {
  const body = req.body as Partial<typeof mcPaymentsTable.$inferInsert> & {
    notification?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number };
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  // Students may only upload proof (limited fields); teachers may update anything
  if (req.jwtUser!.role === "student") {
    const existing = await db.select().from(mcPaymentsTable).where(eq(mcPaymentsTable.id, req.params.id));
    if (!existing.length || existing[0].userId !== req.jwtUser!.userId) {
      res.status(403).json({ error: "Tidak dapat mengubah pembayaran milik siswa lain." });
      return;
    }
    // Students may only set proof fields and status=pending
    const allowed: Partial<typeof mcPaymentsTable.$inferInsert> = {};
    if (body.proofFileName !== undefined) allowed.proofFileName = body.proofFileName;
    if (body.proofDataUrl !== undefined) allowed.proofDataUrl = body.proofDataUrl;
    if (body.uploadedAt !== undefined) allowed.uploadedAt = body.uploadedAt;
    if (body.paymentMethod !== undefined) allowed.paymentMethod = body.paymentMethod;
    if (body.status === "pending") allowed.status = "pending";
    const [updated] = await db.update(mcPaymentsTable).set(allowed).where(eq(mcPaymentsTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Pembayaran tidak ditemukan." }); return; }
    const { notification, notifications } = body;
    const notifRows = [
      ...(notification ? [{ ...notification, link: notification.link ?? null, read: false }] : []),
      ...(notifications?.map((n) => ({ ...n, link: n.link ?? null, read: false })) ?? []),
    ];
    if (notifRows.length) await db.insert(mcNotificationsTable).values(notifRows);
    return res.json(updated);
  }
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
