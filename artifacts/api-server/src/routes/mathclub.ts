import { Router } from "express";
import { db, mcUsersTable, mcSettingsTable, mcClassMessagesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

const DEFAULT_CLASSES: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `X-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `XI-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `XII-${i + 1}`),
];

const CLASSES_KEY = "mc_classes";

async function getClasses(): Promise<string[]> {
  const [row] = await db.select().from(mcSettingsTable).where(eq(mcSettingsTable.key, CLASSES_KEY));
  if (!row) return DEFAULT_CLASSES;
  try { return JSON.parse(row.value) as string[]; } catch { return DEFAULT_CLASSES; }
}

router.get("/mc/users", async (req, res) => {
  const users = await db.select().from(mcUsersTable);
  res.json(users.map(({ password: _pw, ...u }) => u));
});

router.post("/mc/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) { res.status(400).json({ error: "Email dan password wajib diisi." }); return; }
  const [user] = await db.select().from(mcUsersTable).where(eq(mcUsersTable.email, email.toLowerCase().trim()));
  if (!user || user.password !== password) { res.status(401).json({ error: "Email atau password salah." }); return; }
  const { password: _pw, ...safe } = user;
  res.json(safe);
});

router.post("/mc/users", async (req, res) => {
  const { id, email, password, name, role, avatarColor, kelas, phone } = req.body as {
    id: string; email: string; password: string; name: string;
    role: string; avatarColor?: string; kelas?: string; phone?: string;
  };
  if (!id || !email || !password || !name || !role) { res.status(400).json({ error: "Data tidak lengkap." }); return; }
  const existing = await db.select({ id: mcUsersTable.id }).from(mcUsersTable).where(eq(mcUsersTable.email, email.toLowerCase().trim()));
  if (existing.length > 0) { res.status(409).json({ error: "Email sudah terdaftar." }); return; }
  const [created] = await db.insert(mcUsersTable).values({
    id, email: email.toLowerCase().trim(), password, name, role,
    avatarColor: avatarColor ?? null, kelas: kelas ?? null, phone: phone ?? null,
  }).returning();
  const { password: _pw, ...safe } = created;
  res.status(201).json(safe);
});

router.put("/mc/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, kelas, phone, avatarColor, password } = req.body as {
    name?: string; kelas?: string | null; phone?: string | null;
    avatarColor?: string; password?: string;
  };
  const updates: Partial<typeof mcUsersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (kelas !== undefined) updates.kelas = kelas ?? null;
  if (phone !== undefined) updates.phone = phone ?? null;
  if (avatarColor !== undefined) updates.avatarColor = avatarColor;
  if (password !== undefined) updates.password = password;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Tidak ada perubahan." }); return; }
  const [updated] = await db.update(mcUsersTable).set(updates).where(eq(mcUsersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User tidak ditemukan." }); return; }
  const { password: _pw, ...safe } = updated;
  res.json(safe);
});

router.delete("/mc/users/:id", async (req, res) => {
  await db.delete(mcUsersTable).where(eq(mcUsersTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/mc/messages/:kelas", async (req, res) => {
  const { kelas } = req.params;
  const rows = await db
    .select()
    .from(mcClassMessagesTable)
    .where(eq(mcClassMessagesTable.kelas, kelas))
    .orderBy(asc(mcClassMessagesTable.createdAt));
  res.json(rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).getTime() })));
});

router.post("/mc/messages", async (req, res) => {
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

router.delete("/mc/messages/:id", async (req, res) => {
  await db.delete(mcClassMessagesTable).where(eq(mcClassMessagesTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/mc/classes", async (_req, res) => {
  res.json(await getClasses());
});

router.put("/mc/classes", async (req, res) => {
  const classes = req.body as string[];
  if (!Array.isArray(classes)) { res.status(400).json({ error: "Format tidak valid." }); return; }
  await db.insert(mcSettingsTable).values({ key: CLASSES_KEY, value: JSON.stringify(classes) })
    .onConflictDoUpdate({ target: mcSettingsTable.key, set: { value: JSON.stringify(classes) } });
  res.json(classes);
});

export default router;
