import { Router, type IRouter } from "express";
import { db, contactsTable, interactionsTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  CreateContactBody,
  UpdateContactBody,
  GetContactParams,
  UpdateContactParams,
  DeleteContactParams,
  ListContactsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  const q = ListContactsQueryParams.parse(req.query);
  const conds = [] as any[];
  if (q.search) {
    conds.push(
      or(
        ilike(contactsTable.name, `%${q.search}%`),
        ilike(contactsTable.affiliation, `%${q.search}%`),
        ilike(contactsTable.email, `%${q.search}%`)
      )
    );
  }
  if (q.stageId) conds.push(eq(contactsTable.stageId, q.stageId));
  if (q.tag) {
    conds.push(sql`${contactsTable.tags} @> ${JSON.stringify([q.tag])}::jsonb`);
  }
  const rows = await db
    .select()
    .from(contactsTable)
    .where(conds.length ? (sql.join(conds, sql` AND `) as any) : undefined)
    .orderBy(contactsTable.updatedAt);
  res.json(rows.reverse());
});

router.post("/contacts", async (req, res) => {
  const body = CreateContactBody.parse(req.body);
  const now = new Date();
  const [row] = await db
    .insert(contactsTable)
    .values({
      id: randomUUID(),
      name: body.name,
      affiliation: body.affiliation ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      stageId: body.stageId ?? null,
      tags: body.tags ?? [],
      notes: body.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  res.json(row);
});

router.get("/contacts/:id", async (req, res) => {
  const { id } = GetContactParams.parse(req.params);
  const [row] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.patch("/contacts/:id", async (req, res) => {
  const { id } = UpdateContactParams.parse(req.params);
  const body = UpdateContactBody.parse(req.body);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) patch[k] = v;
  }
  const [row] = await db
    .update(contactsTable)
    .set(patch)
    .where(eq(contactsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/contacts/:id", async (req, res) => {
  const { id } = DeleteContactParams.parse(req.params);
  await db.delete(interactionsTable).where(eq(interactionsTable.contactId, id));
  await db.delete(contactsTable).where(eq(contactsTable.id, id));
  res.status(204).send();
});

export default router;
