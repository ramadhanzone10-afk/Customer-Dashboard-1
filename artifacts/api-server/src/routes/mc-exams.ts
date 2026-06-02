import { Router } from "express";
import { db, mcExamsTable, mcExamSubmissionsTable, mcNotificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/mc/exams", async (_req, res) => {
  const rows = await db.select().from(mcExamsTable);
  res.json(rows.map((r) => ({ ...r, questions: r.questions, assignedTo: r.assignedTo as string[] })));
});

router.post("/mc/exams", async (req, res) => {
  const body = req.body as {
    id: string; title: string; description: string; questions: unknown;
    durationMinutes: number; deadline: number; assignedTo: string[];
    createdBy: string; createdAt: number;
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  if (!body.id || !body.title || !body.createdBy) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const bodyAny = body as Record<string, unknown>;
  const [created] = await db.insert(mcExamsTable).values({
    id: body.id, title: body.title, description: body.description,
    questions: body.questions, durationMinutes: body.durationMinutes,
    deadline: body.deadline, assignedTo: body.assignedTo ?? [],
    createdBy: body.createdBy, createdAt: body.createdAt,
    type: (bodyAny.type as string) ?? "exam",
    shuffleQuestions: (bodyAny.shuffleQuestions as boolean) ?? false,
    shuffleOptions: (bodyAny.shuffleOptions as boolean) ?? false,
    passingScore: (bodyAny.passingScore as number) ?? 70,
  }).returning();
  if (body.notifications?.length) {
    await db.insert(mcNotificationsTable).values(body.notifications.map((n) => ({ ...n, link: n.link ?? null, read: false })));
  }
  res.status(201).json({ ...created, assignedTo: created.assignedTo as string[] });
});

router.put("/mc/exams/:id", async (req, res) => {
  const body = req.body as Partial<typeof mcExamsTable.$inferInsert>;
  const [updated] = await db.update(mcExamsTable).set({
    title: body.title,
    description: body.description,
    questions: body.questions,
    durationMinutes: body.durationMinutes,
    deadline: body.deadline,
    assignedTo: body.assignedTo ?? [],
    type: body.type ?? "exam",
    shuffleQuestions: body.shuffleQuestions ?? false,
    shuffleOptions: body.shuffleOptions ?? false,
    passingScore: body.passingScore ?? 70,
  }).where(eq(mcExamsTable.id, req.params.id)).returning();
  if (!updated) { res.status(404).json({ error: "Ujian tidak ditemukan." }); return; }
  res.json({ ...updated, assignedTo: updated.assignedTo as string[] });
});

router.delete("/mc/exams/:id", async (req, res) => {
  await db.delete(mcExamsTable).where(eq(mcExamsTable.id, req.params.id));
  await db.delete(mcExamSubmissionsTable).where(eq(mcExamSubmissionsTable.examId, req.params.id));
  res.json({ ok: true });
});

router.get("/mc/exam-submissions", async (_req, res) => {
  const rows = await db.select().from(mcExamSubmissionsTable);
  res.json(rows.map((r) => ({ ...r, answers: r.answers })));
});

router.post("/mc/exam-submissions", async (req, res) => {
  const body = req.body as typeof mcExamSubmissionsTable.$inferInsert;
  if (!body.id || !body.examId || !body.userId) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const existing = await db.select({ id: mcExamSubmissionsTable.id })
    .from(mcExamSubmissionsTable)
    .where(eq(mcExamSubmissionsTable.examId, body.examId));
  if (existing.some((r) => r.id === body.id)) { res.json({ ok: true }); return; }
  const [created] = await db.insert(mcExamSubmissionsTable).values({
    ...body, gradedAt: body.gradedAt ?? null,
  }).returning();
  res.status(201).json({ ...created, answers: created.answers });
});

router.put("/mc/exam-submissions/:id", async (req, res) => {
  const body = req.body as Partial<typeof mcExamSubmissionsTable.$inferInsert> & {
    notification?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number };
  };
  const { notification, ...updates } = body;
  const [updated] = await db.update(mcExamSubmissionsTable).set({ ...updates, gradedAt: updates.gradedAt ?? null })
    .where(eq(mcExamSubmissionsTable.id, req.params.id)).returning();
  if (!updated) { res.status(404).json({ error: "Submission tidak ditemukan." }); return; }
  if (notification) {
    await db.insert(mcNotificationsTable).values({ ...notification, link: notification.link ?? null, read: false });
  }
  res.json({ ...updated, answers: updated.answers });
});

export default router;
