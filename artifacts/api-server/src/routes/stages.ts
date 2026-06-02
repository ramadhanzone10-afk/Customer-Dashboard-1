import { Router, type IRouter } from "express";
import { db, stagesTable, contactsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  CreateStageBody,
  UpdateStageBody,
  UpdateStageParams,
  ReorderStagesBody,
  DeleteStageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stages", async (_req, res) => {
  const rows = await db
    .select()
    .from(stagesTable)
    .orderBy(asc(stagesTable.position));
  res.json(rows);
});

router.post("/stages", async (req, res) => {
  const body = CreateStageBody.parse(req.body);
  const existing = await db.select().from(stagesTable);
  const position = existing.length;
  const [row] = await db
    .insert(stagesTable)
    .values({
      id: randomUUID(),
      name: body.name,
      position,
      color: body.color ?? "#64748b",
    })
    .returning();
  res.json(row);
});

router.post("/stages/reorder", async (req, res) => {
  const body = ReorderStagesBody.parse(req.body);
  await Promise.all(
    body.ids.map((id, i) =>
      db.update(stagesTable).set({ position: i }).where(eq(stagesTable.id, id))
    )
  );
  const rows = await db
    .select()
    .from(stagesTable)
    .orderBy(asc(stagesTable.position));
  res.json(rows);
});

router.patch("/stages/:id", async (req, res) => {
  const { id } = UpdateStageParams.parse(req.params);
  const body = UpdateStageBody.parse(req.body);
  const [row] = await db
    .update(stagesTable)
    .set(body)
    .where(eq(stagesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/stages/:id", async (req, res) => {
  const { id } = DeleteStageParams.parse(req.params);
  await db.transaction(async (tx) => {
    await tx
      .update(contactsTable)
      .set({ stageId: null })
      .where(eq(contactsTable.stageId, id));
    await tx.delete(stagesTable).where(eq(stagesTable.id, id));
  });
  res.status(204).send();
});

export default router;
