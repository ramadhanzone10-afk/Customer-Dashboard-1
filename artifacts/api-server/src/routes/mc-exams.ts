import { Router } from "express";
import { db, mcExamsTable, mcExamSubmissionsTable, mcNotificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireTeacher } from "../lib/auth";

const router = Router();

// Read exams: both teachers and students can read (frontend filters by assignedTo)
router.get("/mc/exams", requireAuth, async (_req, res) => {
  const rows = await db.select().from(mcExamsTable);
  res.json(rows.map((r) => ({
    ...r,
    questions: r.questions,
    assignedTo: r.assignedTo as string[],
    status: r.status ?? "draft",
    startDateTime: r.startDateTime ?? undefined,
  })));
});

// Manage exams: teacher only
router.post("/mc/exams", requireTeacher, async (req, res) => {
  const body = req.body as {
    id: string; title: string; description: string; questions: unknown;
    durationMinutes: number; deadline: number; assignedTo: string[];
    createdBy: string; createdAt: number;
    type?: string; status?: string; startDateTime?: number;
    shuffleQuestions?: boolean; shuffleOptions?: boolean; passingScore?: number;
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  if (!body.id || !body.title) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const createdBy = req.jwtUser!.userId;
  const [created] = await db.insert(mcExamsTable).values({
    id: body.id, title: body.title, description: body.description,
    questions: body.questions, durationMinutes: body.durationMinutes,
    deadline: body.deadline, assignedTo: body.assignedTo ?? [],
    createdBy, createdAt: body.createdAt,
    type: body.type ?? "exam",
    status: body.status ?? "draft",
    startDateTime: body.startDateTime ?? null,
    shuffleQuestions: body.shuffleQuestions ?? false,
    shuffleOptions: body.shuffleOptions ?? false,
    passingScore: body.passingScore ?? 70,
  }).returning();
  if (body.notifications?.length) {
    await db.insert(mcNotificationsTable).values(body.notifications.map((n) => ({ ...n, link: n.link ?? null, read: false })));
  }
  res.status(201).json({
    ...created,
    assignedTo: created.assignedTo as string[],
    status: created.status ?? "draft",
    startDateTime: created.startDateTime ?? undefined,
  });
});

router.put("/mc/exams/:id", requireTeacher, async (req, res) => {
  const body = req.body as Partial<typeof mcExamsTable.$inferInsert> & {
    notifications?: { id: string; userId: string; type: string; title: string; message: string; link?: string; createdAt: number }[];
  };
  const { notifications, ...updates } = body;
  const [updated] = await db.update(mcExamsTable).set({
    title: updates.title,
    description: updates.description,
    questions: updates.questions,
    durationMinutes: updates.durationMinutes,
    deadline: updates.deadline,
    startDateTime: updates.startDateTime ?? null,
    assignedTo: updates.assignedTo ?? [],
    type: updates.type ?? "exam",
    status: updates.status ?? undefined,
    shuffleQuestions: updates.shuffleQuestions ?? false,
    shuffleOptions: updates.shuffleOptions ?? false,
    passingScore: updates.passingScore ?? 70,
  }).where(eq(mcExamsTable.id, req.params.id)).returning();
  if (!updated) { res.status(404).json({ error: "Ujian tidak ditemukan." }); return; }
  if (notifications?.length) {
    await db.insert(mcNotificationsTable).values(notifications.map((n) => ({ ...n, link: n.link ?? null, read: false })));
  }
  res.json({
    ...updated,
    assignedTo: updated.assignedTo as string[],
    status: updated.status ?? "draft",
    startDateTime: updated.startDateTime ?? undefined,
  });
});

router.delete("/mc/exams/:id", requireTeacher, async (req, res) => {
  await db.delete(mcExamsTable).where(eq(mcExamsTable.id, req.params.id));
  await db.delete(mcExamSubmissionsTable).where(eq(mcExamSubmissionsTable.examId, req.params.id));
  res.json({ ok: true });
});

// Submissions: teachers see all; students see their own only
router.get("/mc/exam-submissions", requireAuth, async (req, res) => {
  const rows = await db.select().from(mcExamSubmissionsTable);
  if (req.jwtUser!.role === "teacher") {
    res.json(rows.map((r) => ({ ...r, answers: r.answers })));
  } else {
    res.json(rows.filter((r) => r.userId === req.jwtUser!.userId).map((r) => ({ ...r, answers: r.answers })));
  }
});

// Submit: authenticated; userId is always taken from the token
router.post("/mc/exam-submissions", requireAuth, async (req, res) => {
  const body = req.body as typeof mcExamSubmissionsTable.$inferInsert & { cbtViolations?: number };
  if (!body.id || !body.examId) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const userId = req.jwtUser!.userId;
  if (req.jwtUser!.role === "student" && body.userId !== userId) {
    res.status(403).json({ error: "Tidak dapat mengumpulkan atas nama siswa lain." });
    return;
  }
  const existing = await db.select({ id: mcExamSubmissionsTable.id })
    .from(mcExamSubmissionsTable)
    .where(eq(mcExamSubmissionsTable.examId, body.examId));
  if (existing.some((r) => r.id === body.id)) { res.json({ ok: true }); return; }
  const [created] = await db.insert(mcExamSubmissionsTable).values({
    ...body, userId, gradedAt: body.gradedAt ?? null,
    cbtViolations: body.cbtViolations ?? 0,
  }).returning();
  res.status(201).json({ ...created, answers: created.answers });
});

// Grade submission: teacher only
router.put("/mc/exam-submissions/:id", requireTeacher, async (req, res) => {
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
