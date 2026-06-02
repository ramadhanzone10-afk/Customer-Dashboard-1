import { db, workspaceTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const WORKSPACE_ID = "default";

export async function getOrCreateWorkspace() {
  const [existing] = await db
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, WORKSPACE_ID));
  if (existing) return existing;
  const [created] = await db
    .insert(workspaceTable)
    .values({ id: WORKSPACE_ID })
    .returning();
  return created;
}

export { WORKSPACE_ID };
