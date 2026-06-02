import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, mcUsersTable, mcSettingsTable, mcClassMessagesTable, mcNotificationsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { signToken, requireAuth, requireTeacher } from "../lib/auth";

const router = Router();

const DEFAULT_CLASSES: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `X-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `XI-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `XII-${i + 1}`),
];

const CLASSES_KEY = "mc_classes";
const TEACHER_CODE_KEY = "teacher_registration_code";
const DEFAULT_TEACHER_CODE = "GURU2024";
const BCRYPT_ROUNDS = 10;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

async function getClasses(): Promise<string[]> {
  const [row] = await db.select().from(mcSettingsTable).where(eq(mcSettingsTable.key, CLASSES_KEY));
  if (!row) return DEFAULT_CLASSES;
  try { return JSON.parse(row.value) as string[]; } catch { return DEFAULT_CLASSES; }
}

async function getTeacherCode(): Promise<string> {
  const [row] = await db.select().from(mcSettingsTable).where(eq(mcSettingsTable.key, TEACHER_CODE_KEY));
  if (!row) return DEFAULT_TEACHER_CODE;
  return row.value;
}

// ── Public: login ─────────────────────────────────────────────────────────────
router.post("/mc/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) { res.status(400).json({ error: "Email dan password wajib diisi." }); return; }
  const [user] = await db.select().from(mcUsersTable).where(eq(mcUsersTable.email, email.toLowerCase().trim()));
  if (!user) { res.status(401).json({ error: "Email atau password salah." }); return; }
  const valid = await verifyPassword(password, user.password);
  if (!valid) { res.status(401).json({ error: "Email atau password salah." }); return; }
  if (user.status === "pending") { res.status(403).json({ error: "Akun Anda sedang menunggu persetujuan guru." }); return; }
  // Migrate plaintext password to bcrypt hash
  if (!user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
    const hashed = await hashPassword(password);
    await db.update(mcUsersTable).set({ password: hashed }).where(eq(mcUsersTable.id, user.id));
  }
  const token = signToken({ userId: user.id, role: user.role as "teacher" | "student" });
  const { password: _pw, ...safe } = user;
  res.json({ user: safe, token });
});

// ── Public: student registration ──────────────────────────────────────────────
router.post("/mc/auth/register", async (req, res) => {
  const { id, email, password, name, avatarColor, kelas, phone, teacherId } = req.body as {
    id: string; email: string; password: string; name: string;
    avatarColor?: string; kelas?: string; phone?: string; teacherId?: string;
  };
  if (!id || !email || !password || !name) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const existing = await db.select({ id: mcUsersTable.id }).from(mcUsersTable).where(eq(mcUsersTable.email, email.toLowerCase().trim()));
  if (existing.length > 0) { res.status(409).json({ error: "Email sudah terdaftar." }); return; }
  const hashed = await hashPassword(password);
  const [created] = await db.insert(mcUsersTable).values({
    id, email: email.toLowerCase().trim(), password: hashed, name, role: "student", status: "pending",
    avatarColor: avatarColor ?? null, kelas: kelas ?? null, phone: phone ?? null,
    teacherId: teacherId ?? null,
  }).returning();
  if (teacherId) {
    await db.insert(mcNotificationsTable).values({
      id: `n_reg_${id}`,
      userId: teacherId,
      type: "new_student",
      title: "Siswa Baru Mendaftar",
      message: `${name} memilih Anda sebagai guru pembimbing dan menunggu persetujuan.`,
      link: "/teacher/students",
      read: false,
      createdAt: Date.now(),
    }).catch(() => {});
  }
  const { password: _pw, ...safe } = created;
  res.status(201).json(safe);
});

// ── Public: teacher registration ──────────────────────────────────────────────
router.post("/mc/auth/register-teacher", async (req, res) => {
  const { id, email, password, name, avatarColor, phone, code } = req.body as {
    id: string; email: string; password: string; name: string;
    avatarColor?: string; phone?: string; code: string;
  };
  if (!id || !email || !password || !name || !code) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const validCode = await getTeacherCode();
  if (code.trim() !== validCode) { res.status(403).json({ error: "Kode registrasi guru tidak valid." }); return; }
  const existing = await db.select({ id: mcUsersTable.id }).from(mcUsersTable).where(eq(mcUsersTable.email, email.toLowerCase().trim()));
  if (existing.length > 0) { res.status(409).json({ error: "Email sudah terdaftar." }); return; }
  const hashed = await hashPassword(password);
  const [created] = await db.insert(mcUsersTable).values({
    id, email: email.toLowerCase().trim(), password: hashed, name, role: "teacher", status: "active",
    avatarColor: avatarColor ?? null, phone: phone ?? null,
  }).returning();
  const { password: _pw, ...safe } = created;
  res.status(201).json(safe);
});

// ── Public: list teachers & classes (needed for registration form) ─────────────
router.get("/mc/teachers", async (_req, res) => {
  type UserRow = typeof mcUsersTable.$inferSelect;
  const teachers: UserRow[] = await db.select().from(mcUsersTable)
    .where(and(eq(mcUsersTable.role, "teacher"), eq(mcUsersTable.status, "active")));
  res.json(teachers.map(({ password: _pw, ...u }: UserRow) => u));
});

router.get("/mc/classes", async (_req, res) => {
  res.json(await getClasses());
});

// ── Authenticated: list all users ─────────────────────────────────────────────
router.get("/mc/users", requireAuth, async (req, res) => {
  const users = await db.select().from(mcUsersTable);
  res.json(users.map(({ password: _pw, ...u }) => u));
});

// ── Teacher only: create user directly (seeding) ──────────────────────────────
router.post("/mc/users", requireTeacher, async (req, res) => {
  const { id, email, password, name, role, avatarColor, kelas, phone, teacherId } = req.body as {
    id: string; email: string; password: string; name: string;
    role: string; avatarColor?: string; kelas?: string; phone?: string; teacherId?: string;
  };
  if (!id || !email || !password || !name || !role) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const existing = await db.select({ id: mcUsersTable.id }).from(mcUsersTable).where(eq(mcUsersTable.email, email.toLowerCase().trim()));
  if (existing.length > 0) { res.status(409).json({ error: "Email sudah terdaftar." }); return; }
  const hashed = await hashPassword(password);
  const [created] = await db.insert(mcUsersTable).values({
    id, email: email.toLowerCase().trim(), password: hashed, name, role,
    avatarColor: avatarColor ?? null, kelas: kelas ?? null, phone: phone ?? null,
    teacherId: teacherId ?? null,
  }).returning();
  const { password: _pw, ...safe } = created;
  res.status(201).json(safe);
});

// ── Authenticated: update own profile ────────────────────────────────────────
router.put("/mc/users/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  // Users may only update their own profile; teachers may update anyone
  if (req.jwtUser!.role !== "teacher" && req.jwtUser!.userId !== id) {
    res.status(403).json({ error: "Tidak diizinkan mengubah profil pengguna lain." });
    return;
  }
  const { name, kelas, phone, avatarColor, password, teacherId } = req.body as {
    name?: string; kelas?: string | null; phone?: string | null;
    avatarColor?: string; password?: string; teacherId?: string | null;
  };
  const updates: Partial<typeof mcUsersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (kelas !== undefined) updates.kelas = kelas ?? null;
  if (phone !== undefined) updates.phone = phone ?? null;
  if (avatarColor !== undefined) updates.avatarColor = avatarColor;
  if (password !== undefined) updates.password = await hashPassword(password);
  if (teacherId !== undefined) updates.teacherId = teacherId ?? null;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Tidak ada perubahan." }); return; }
  const [updated] = await db.update(mcUsersTable).set(updates).where(eq(mcUsersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User tidak ditemukan." }); return; }
  if (teacherId && updated.role === "student") {
    await db.insert(mcNotificationsTable).values({
      id: `n_chg_${id}_${Date.now()}`,
      userId: teacherId,
      type: "new_student",
      title: "Siswa Baru Bergabung",
      message: `${updated.name} memilih Anda sebagai guru pembimbing.`,
      link: "/teacher/students",
      read: false,
      createdAt: Date.now(),
    }).catch(() => {});
  }
  const { password: _pw, ...safe } = updated;
  res.json(safe);
});

// ── Teacher only: approve/delete users ───────────────────────────────────────
router.put("/mc/users/:id/approve", requireTeacher, async (req, res) => {
  const { id } = req.params;
  const [updated] = await db
    .update(mcUsersTable)
    .set({ status: "active" })
    .where(eq(mcUsersTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "User tidak ditemukan." }); return; }
  const { password: _pw, ...safe } = updated;
  res.json(safe);
});

router.delete("/mc/users/:id", requireTeacher, async (req, res) => {
  await db.delete(mcUsersTable).where(eq(mcUsersTable.id, req.params.id));
  res.json({ ok: true });
});

// ── Authenticated: class messages ─────────────────────────────────────────────
router.get("/mc/messages/:kelas", requireAuth, async (req, res) => {
  const { kelas } = req.params;
  const rows = await db
    .select()
    .from(mcClassMessagesTable)
    .where(eq(mcClassMessagesTable.kelas, kelas))
    .orderBy(asc(mcClassMessagesTable.createdAt));
  res.json(rows.map((r: typeof mcClassMessagesTable.$inferSelect) => ({ ...r, createdAt: new Date(r.createdAt).getTime() })));
});

router.post("/mc/messages", requireAuth, async (req, res) => {
  const { id, kelas, userId, text } = req.body as {
    id: string; kelas: string; userId: string; text: string;
  };
  if (!id || !kelas || !userId || !text?.trim()) {
    res.status(400).json({ error: "Data tidak lengkap." });
    return;
  }
  const [created] = await db
    .insert(mcClassMessagesTable)
    .values({ id, kelas, userId, text: text.trim() })
    .returning();
  res.status(201).json({ ...created, createdAt: new Date(created.createdAt).getTime() });
});

router.delete("/mc/messages/:id", requireAuth, async (req, res) => {
  await db.delete(mcClassMessagesTable).where(eq(mcClassMessagesTable.id, req.params.id));
  res.json({ ok: true });
});

// ── Teacher only: manage classes & teacher code ───────────────────────────────
router.put("/mc/classes", requireTeacher, async (req, res) => {
  const classes = req.body as string[];
  if (!Array.isArray(classes)) { res.status(400).json({ error: "Format tidak valid." }); return; }
  await db.insert(mcSettingsTable).values({ key: CLASSES_KEY, value: JSON.stringify(classes) })
    .onConflictDoUpdate({ target: mcSettingsTable.key, set: { value: JSON.stringify(classes) } });
  res.json(classes);
});

router.get("/mc/teacher-code", requireTeacher, async (_req, res) => {
  const code = await getTeacherCode();
  res.json({ code });
});

router.put("/mc/teacher-code", requireTeacher, async (req, res) => {
  const { code } = req.body as { code: string };
  if (!code?.trim()) { res.status(400).json({ error: "Kode tidak boleh kosong." }); return; }
  await db.insert(mcSettingsTable).values({ key: TEACHER_CODE_KEY, value: code.trim() })
    .onConflictDoUpdate({ target: mcSettingsTable.key, set: { value: code.trim() } });
  res.json({ code: code.trim() });
});

export default router;
