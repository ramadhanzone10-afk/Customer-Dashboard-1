import { db, workspaceTable, stagesTable, contactsTable, interactionsTable, pool } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

async function main() {
  const WORKSPACE_ID = "default";
  const [existing] = await db.select().from(workspaceTable).where(eq(workspaceTable.id, WORKSPACE_ID));
  if (existing && existing.initialized) {
    console.log("Workspace already initialized, skipping seed");
    await pool.end();
    return;
  }

  if (!existing) {
    await db.insert(workspaceTable).values({ id: WORKSPACE_ID });
  }

  await db.update(workspaceTable).set({
    initialized: true,
    relationshipType: "sales",
    entityLabel: "Lead",
    entityLabelPlural: "Leads",
    affiliationLabel: "Company",
  }).where(eq(workspaceTable.id, WORKSPACE_ID));

  const stageDefs = [
    { name: "New", color: "#64748b" },
    { name: "Contacted", color: "#6366f1" },
    { name: "Qualified", color: "#0ea5e9" },
    { name: "Proposal", color: "#f59e0b" },
    { name: "Closed Won", color: "#10b981" },
    { name: "Closed Lost", color: "#ef4444" },
  ];
  const stages = stageDefs.map((s, i) => ({
    id: randomUUID(),
    name: s.name,
    color: s.color,
    position: i,
  }));
  await db.delete(stagesTable);
  await db.insert(stagesTable).values(stages);

  const contacts = [
    { name: "Ava Chen", affiliation: "Northwind Capital", email: "ava@northwind.vc", phone: "+1 415 555 0142", stage: "Qualified", tags: ["investor", "warm"], notes: "Met at SaaStr. Following up next week with deck v2." },
    { name: "Marcus Obi", affiliation: "Formstack", email: "marcus@formstack.com", phone: "+1 512 555 0199", stage: "Proposal", tags: ["enterprise"], notes: "Budget approved. Legal review in progress." },
    { name: "Sofia Alvarez", affiliation: "Clearwater Labs", email: "sofia@clearwater.io", stage: "Contacted", tags: ["startup", "inbound"], notes: "Interested in team plan. Demo scheduled." },
    { name: "Theo Lindqvist", affiliation: "Aker BP", email: "theo.l@akerbp.no", phone: "+47 901 23 456", stage: "New", tags: ["europe"], notes: "Cold outreach via LinkedIn." },
    { name: "Priya Raman", affiliation: "Parallel Health", email: "priya@parallelhealth.com", stage: "Closed Won", tags: ["healthcare", "champion"], notes: "Signed annual contract. Kickoff Monday." },
    { name: "Daniel Okafor", affiliation: "Mercury", email: "d.okafor@mercury.com", stage: "Qualified", tags: ["fintech"], notes: "Evaluating against two competitors." },
    { name: "Lena Morozova", affiliation: "Skylark Studios", email: "lena@skylark.design", stage: "New", tags: ["design", "inbound"] },
    { name: "Harun Yildiz", affiliation: "Korteks", email: "harun@korteks.com.tr", stage: "Closed Lost", tags: ["enterprise"], notes: "Went with an incumbent. Revisit Q3." },
  ];

  const contactRows = contacts.map((c) => {
    const stage = stages.find((s) => s.name === c.stage)!;
    return {
      id: randomUUID(),
      name: c.name,
      affiliation: c.affiliation ?? null,
      email: c.email ?? null,
      phone: (c as any).phone ?? null,
      stageId: stage.id,
      tags: c.tags ?? [],
      notes: c.notes ?? null,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000),
    };
  });
  await db.insert(contactsTable).values(contactRows);

  const interactions: typeof interactionsTable.$inferInsert[] = [];
  const sample = [
    { kind: "call", body: "30-min intro call. Walked through product overview, discussed integration needs." },
    { kind: "email", body: "Sent follow-up with pricing tier comparison and case study link." },
    { kind: "meeting", body: "Team demo with 4 stakeholders. Strong signal from head of ops." },
    { kind: "note", body: "Champion mentioned budget cycle closes end of quarter. Need to move." },
    { kind: "email", body: "Replied with contract redline. Awaiting legal sign-off." },
  ];
  for (const c of contactRows.slice(0, 6)) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = sample[(i + contactRows.indexOf(c)) % sample.length];
      const ago = Math.random() * 14 * 24 * 60 * 60 * 1000;
      interactions.push({
        id: randomUUID(),
        contactId: c.id,
        kind: s.kind,
        body: s.body,
        occurredAt: new Date(Date.now() - ago),
        createdAt: new Date(Date.now() - ago),
      });
    }
  }
  await db.delete(interactionsTable);
  if (interactions.length) await db.insert(interactionsTable).values(interactions);

  console.log(`Seeded: ${stages.length} stages, ${contactRows.length} contacts, ${interactions.length} interactions`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
