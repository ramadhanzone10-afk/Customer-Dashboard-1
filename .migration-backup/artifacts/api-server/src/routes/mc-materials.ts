import { Router } from "express";
import { db, mcMaterialsTable, mcMaterialProgressTable, mcNotificationsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

router.get("/mc/materials", async (_req, res) => {
  const rows = await db.select().from(mcMaterialsTable);
  res.json(rows.map((r) => ({ ...r, assignedTo: r.assignedTo as string[] })));
});

router.post("/mc/materials", async (req, res) => {
  const m = req.body as {
    id: string; title: string; description: string; content: string;
    fileName?: string; fileDataUrl?: string; videoUrl?: string;
    videoFileName?: string; videoDataUrl?: string; timerMinutes?: number;
    createdBy: string; assignedTo: string[]; createdAt: number;
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  if (!m.id || !m.title || !m.createdBy) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const [created] = await db.insert(mcMaterialsTable).values({
    ...m, assignedTo: m.assignedTo ?? [], timerMinutes: m.timerMinutes ?? null,
    fileName: m.fileName ?? null, fileDataUrl: m.fileDataUrl ?? null,
    videoUrl: m.videoUrl ?? null, videoFileName: m.videoFileName ?? null, videoDataUrl: m.videoDataUrl ?? null,
  }).returning();
  if (m.notifications?.length) {
    await db.insert(mcNotificationsTable).values(m.notifications.map((n) => ({ ...n, link: n.link ?? null, read: false })));
  }
  res.status(201).json({ ...created, assignedTo: created.assignedTo as string[] });
});

router.put("/mc/materials/:id", async (req, res) => {
  const m = req.body as Partial<typeof mcMaterialsTable.$inferInsert>;
  const [updated] = await db.update(mcMaterialsTable).set({
    ...m, assignedTo: m.assignedTo ?? undefined,
  }).where(eq(mcMaterialsTable.id, req.params.id)).returning();
  if (!updated) { res.status(404).json({ error: "Materi tidak ditemukan." }); return; }
  res.json({ ...updated, assignedTo: updated.assignedTo as string[] });
});

router.delete("/mc/materials/:id", async (req, res) => {
  await db.delete(mcMaterialsTable).where(eq(mcMaterialsTable.id, req.params.id));
  await db.delete(mcMaterialProgressTable).where(eq(mcMaterialProgressTable.materialId, req.params.id));
  res.json({ ok: true });
});

router.get("/mc/material-progress", async (_req, res) => {
  const rows = await db.select().from(mcMaterialProgressTable);
  res.json(rows);
});

router.post("/mc/material-progress", async (req, res) => {
  const { userId, materialId, completedAt } = req.body as { userId: string; materialId: string; completedAt: number };
  if (!userId || !materialId) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const existing = await db.select().from(mcMaterialProgressTable)
    .where(eq(mcMaterialProgressTable.userId, userId));
  const alreadyDone = existing.find((r) => r.materialId === materialId);
  if (alreadyDone) { res.json(alreadyDone); return; }
  const [created] = await db.insert(mcMaterialProgressTable).values({ userId, materialId, completedAt }).returning();
  res.status(201).json(created);
});

export default router;
