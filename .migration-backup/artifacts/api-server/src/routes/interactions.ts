import { Router, type IRouter } from "express";
import { db, interactionsTable, contactsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const ALLOWED_KINDS = new Set(["note", "call", "meeting", "email"]);
import { randomUUID } from "node:crypto";
import {
  CreateInteractionBody,
  CreateInteractionParams,
  ListInteractionsParams,
  DeleteInteractionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts/:id/interactions", async (req, res) => {
  const { id } = ListInteractionsParams.parse(req.params);
  const rows = await db
    .select()
    .from(interactionsTable)
    .where(eq(interactionsTable.contactId, id))
    .orderBy(desc(interactionsTable.occurredAt));
  res.json(rows);
});

router.post("/contacts/:id/interactions", async (req, res) => {
  const { id } = CreateInteractionParams.parse(req.params);
  const body = CreateInteractionBody.parse(req.body);
  if (!ALLOWED_KINDS.has(body.kind)) {
    res.status(400).json({ error: "Invalid kind. Must be note, call, meeting, or email." });
    return;
  }
  const [contact] = await db.select({ id: contactsTable.id }).from(contactsTable).where(eq(contactsTable.id, id));
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const now = new Date();
  const [row] = await db
    .insert(interactionsTable)
    .values({
      id: randomUUID(),
      contactId: id,
      kind: body.kind,
      body: body.body,
      occurredAt: body.occurredAt ?? now,
      createdAt: now,
    })
    .returning();
  res.json(row);
});

router.delete("/interactions/:id", async (req, res) => {
  const { id } = DeleteInteractionParams.parse(req.params);
  await db.delete(interactionsTable).where(eq(interactionsTable.id, id));
  res.status(204).send();
});

export default router;
