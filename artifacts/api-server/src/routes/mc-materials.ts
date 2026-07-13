import { Router } from "express";
import { db, mcMaterialsTable, mcMaterialProgressTable, mcNotificationsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireTeacher } from "../lib/auth";

const router = Router();

// Read: authenticated users get all assigned materials
// (frontend filters by assignedTo; teacher sees all for management)
router.get("/mc/materials", requireAuth, async (_req, res) => {
  const rows = await db.select().from(mcMaterialsTable);
  res.json(rows.map((r) => ({
    ...r,
    assignedTo: r.assignedTo as string[],
    status: r.status ?? "draft",
    materialType: r.materialType ?? "materi",
    availableFrom: r.availableFrom ?? undefined,
    availableUntil: r.availableUntil ?? undefined,
  })));
});

// Create/update/delete: teacher only
router.post("/mc/materials", requireTeacher, async (req, res) => {
  const m = req.body as {
    id: string; title: string; description: string; content: string;
    subject?: string; bab?: string;
    fileName?: string; fileDataUrl?: string; videoUrl?: string;
    videoFileName?: string; videoDataUrl?: string; timerMinutes?: number;
    createdBy: string; assignedTo: string[]; createdAt: number;
    status?: string; materialType?: string;
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  if (!m.id || !m.title) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const createdBy = req.jwtUser!.userId;
  const body = m as Record<string, unknown>;
  const [created] = await db.insert(mcMaterialsTable).values({
    ...m, createdBy, assignedTo: m.assignedTo ?? [],
    timerMinutes: m.timerMinutes ?? null,
    fileName: m.fileName ?? null, fileDataUrl: m.fileDataUrl ?? null,
    imageDataUrl: body.imageDataUrl as string | null ?? null,
    videoUrl: m.videoUrl ?? null, videoFileName: m.videoFileName ?? null, videoDataUrl: m.videoDataUrl ?? null,
    status: m.status ?? "draft",
    materialType: m.materialType ?? "materi",
    availableFrom: (body.availableFrom as number | null | undefined) ?? null,
    availableUntil: (body.availableUntil as number | null | undefined) ?? null,
  }).returning();
  if (m.notifications?.length) {
    await db.insert(mcNotificationsTable).values(m.notifications.map((n) => ({ ...n, link: n.link ?? null, read: false })));
  }
  res.status(201).json({
    ...created,
    assignedTo: created.assignedTo as string[],
    status: created.status ?? "draft",
    materialType: created.materialType ?? "materi",
    availableFrom: created.availableFrom ?? undefined,
    availableUntil: created.availableUntil ?? undefined,
  });
});

router.put("/mc/materials/:id", requireTeacher, async (req, res) => {
  const m = req.body as Partial<typeof mcMaterialsTable.$inferInsert> & {
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  const { notifications, ...updates } = m;
  const upd = updates as Record<string, unknown>;
  const [updated] = await db.update(mcMaterialsTable).set({
    ...updates,
    assignedTo: updates.assignedTo ?? undefined,
    status: updates.status ?? undefined,
    materialType: updates.materialType ?? undefined,
    availableFrom: upd.availableFrom !== undefined ? (upd.availableFrom as number | null) : undefined,
    availableUntil: upd.availableUntil !== undefined ? (upd.availableUntil as number | null) : undefined,
  }).where(eq(mcMaterialsTable.id, req.params.id)).returning();
  if (!updated) { res.status(404).json({ error: "Materi tidak ditemukan." }); return; }
  if (notifications?.length) {
    await db.insert(mcNotificationsTable).values(notifications.map((n) => ({ ...n, link: n.link ?? null, read: false })));
  }
  res.json({
    ...updated,
    assignedTo: updated.assignedTo as string[],
    status: updated.status ?? "draft",
    materialType: updated.materialType ?? "materi",
    availableFrom: updated.availableFrom ?? undefined,
    availableUntil: updated.availableUntil ?? undefined,
  });
});

router.delete("/mc/materials/:id", requireTeacher, async (req, res) => {
  await db.delete(mcMaterialsTable).where(eq(mcMaterialsTable.id, req.params.id));
  await db.delete(mcMaterialProgressTable).where(eq(mcMaterialProgressTable.materialId, req.params.id));
  res.json({ ok: true });
});

// Material progress: authenticated; students may only record their own progress
router.get("/mc/material-progress", requireAuth, async (req, res) => {
  const rows = await db.select().from(mcMaterialProgressTable);
  if (req.jwtUser!.role === "teacher") {
    res.json(rows);
  } else {
    res.json(rows.filter((r) => r.userId === req.jwtUser!.userId));
  }
});

router.post("/mc/material-progress", requireAuth, async (req, res) => {
  const { materialId, completedAt } = req.body as { userId?: string; materialId: string; completedAt: number };
  const userId = req.jwtUser!.userId;
  if (!materialId) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const existing = await db.select().from(mcMaterialProgressTable)
    .where(eq(mcMaterialProgressTable.userId, userId));
  const alreadyDone = existing.find((r) => r.materialId === materialId);
  if (alreadyDone) { res.json(alreadyDone); return; }
  const [created] = await db.insert(mcMaterialProgressTable).values({ userId, materialId, completedAt }).returning();
  res.status(201).json(created);
});

void inArray;

export default router;
