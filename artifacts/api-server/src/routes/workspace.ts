import { Router, type IRouter } from "express";
import { db, workspaceTable, stagesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { UpdateWorkspaceBody, InitializeWorkspaceBody } from "@workspace/api-zod";
import { getOrCreateWorkspace, WORKSPACE_ID } from "../lib/workspace";

const router: IRouter = Router();

router.get("/workspace", async (_req, res) => {
  const ws = await getOrCreateWorkspace();
  res.json(ws);
});

router.put("/workspace", async (req, res) => {
  const body = UpdateWorkspaceBody.parse(req.body);
  await getOrCreateWorkspace();
  const [updated] = await db
    .update(workspaceTable)
    .set(body)
    .where(eq(workspaceTable.id, WORKSPACE_ID))
    .returning();
  res.json(updated);
});

router.post("/workspace/initialize", async (req, res) => {
  const body = InitializeWorkspaceBody.parse(req.body);
  const cleanNames = body.stageNames.map((s) => s.trim()).filter(Boolean);
  if (cleanNames.length === 0) {
    res.status(400).json({ error: "At least one stage name is required" });
    return;
  }
  await getOrCreateWorkspace();

  const palette = ["#64748b", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

  const updated = await db.transaction(async (tx) => {
    const [ws] = await tx
      .update(workspaceTable)
      .set({
        relationshipType: body.relationshipType,
        entityLabel: body.entityLabel,
        entityLabelPlural: body.entityLabelPlural,
        affiliationLabel: body.affiliationLabel,
        initialized: true,
      })
      .where(eq(workspaceTable.id, WORKSPACE_ID))
      .returning();

    const existing = await tx.select().from(stagesTable).orderBy(asc(stagesTable.position));
    if (existing.length === 0) {
      await tx.insert(stagesTable).values(
        cleanNames.map((name, i) => ({
          id: randomUUID(),
          name,
          position: i,
          color: palette[i % palette.length],
        }))
      );
    }
    return ws;
  });

  res.json(updated);
});

export default router;
