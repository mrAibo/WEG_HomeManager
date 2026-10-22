// Run only on the synthetic loopback development DB:
// node --env-file=.env --import tsx scripts/e3-db-smoke.ts
// Creates test Cases and deletes only its own records in a finally block.
import { prisma } from "../src/lib/prisma";
import {
  approveLocalCopy, CaseWorkflowError, createLocalCase,
  getApprovedLocalCopy, reviseLocalProposal, submitLocalProposal,
} from "../src/server/ai-case-workflow";

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function mustReject(run: () => Promise<unknown>, hint: string) {
  try { await run(); } catch (error) {
    check(error instanceof CaseWorkflowError, hint + " unexpected error");
    return;
  }
  throw new Error(hint + " unexpectedly succeeded");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const db = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(db.hostname) ||
      db.port !== "5432" || db.pathname !== "/havewa") {
    throw new Error("Refusing to test a non-local/non-synthetic database");
  }
  const tenant = await prisma.tenant.findFirst({
    where: { name: "WEG Demo – Sechs Wohnungen", isDemo: false },
    select: { id: true },
  });
  if (!tenant) throw new Error("Expected isolated synthetic tenant missing");
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "ADMIN" },
    select: { id: true, role: true },
  });
  if (!admin) throw new Error("Synthetic admin missing");
  const actor = { id: admin.id, tenantId: tenant.id, role: admin.role };
  const testInput = {
    kind: "QUESTION" as const,
    summary: "Synthetische Störung am Gemeinschaftseigentum",
    sourceText: "Im Musterhaus gibt es seit gestern einen Wasserfleck.",
    title: "Prüfauftrag vorbereiten",
    body: "Bitte den Wasserschaden am Musterhaus prüfen. Kein Auftrag.",
  };
  let caseId: string | undefined;
  let proposalId: string | undefined;
  try {
    await mustReject(
      () => createLocalCase(actor, { ...testInput, propertyId: "cross-tenant-nonexistent" }),
      "Foreign property ID must be rejected",
    );
    const created = await createLocalCase(actor, testInput);
    caseId = created.caseId;
    proposalId = created.proposalId;
    const first = await prisma.aiProposal.findFirstOrThrow({ where: { id: proposalId, tenantId: tenant.id } });
    check(first.version === 1 && first.state === "DRAFT", "Initial state");
    await mustReject(
      () => approveLocalCopy({ ...actor, role: "BUCHHALTUNG" }, proposalId!, 1),
      "Wrong approver role",
    );
    await mustReject(
      () => submitLocalProposal({ ...actor, tenantId: "some-other-tenant" }, proposalId!, 1),
      "Cross-tenant submit",
    );
    await submitLocalProposal(actor, proposalId, 1);
    await approveLocalCopy(actor, proposalId, 1);
    const copyV1 = await getApprovedLocalCopy(actor, proposalId);
    check(copyV1.version === 1 && copyV1.scope === "COPY_ONLY", "Approved copy v1");
    await reviseLocalProposal(actor, proposalId, 1, {
      title: "Geprüfter Betreff", body: testInput.body,
    });
    await mustReject(
      () => getApprovedLocalCopy(actor, proposalId!),
      "Old approval must not authorize changed version",
    );
    await mustReject(
      () => reviseLocalProposal(actor, proposalId!, 1, { title: "Stale edit", body: testInput.body }),
      "Stale write must fail",
    );
    await submitLocalProposal(actor, proposalId, 2);
    await approveLocalCopy(actor, proposalId, 2);
    await mustReject(
      () => approveLocalCopy(actor, proposalId!, 2),
      "Replayed approval must fail",
    );
    const approved = await getApprovedLocalCopy(actor, proposalId);
    check(approved.version === 2 && approved.title === "Geprüfter Betreff", "Approved copy v2");
    const [approvals, events] = await Promise.all([
      prisma.aiApproval.findMany({ where: { tenantId: tenant.id, proposalId } }),
      prisma.aiCaseEvent.findMany({ where: { tenantId: tenant.id, caseId } }),
    ]);
    check(approvals.length === 2, "Two immutable approval versions");
    check(events.length === 6, "Transactional audit events on each mutation");
    console.log("E3_DB_SMOKE_PASS: tenant isolation, scoped roles, versions, stale-write, replay, audited copy-only approval");
  } finally {
    if (caseId) {
      await prisma.$transaction(async (tx) => {
        if (proposalId) await tx.aiApproval.deleteMany({ where: { tenantId: tenant.id, proposalId } });
        await tx.aiCaseEvent.deleteMany({ where: { tenantId: tenant.id, caseId } });
        await tx.aiProposal.deleteMany({ where: { tenantId: tenant.id, caseId } });
        await tx.aiCase.deleteMany({ where: { tenantId: tenant.id, id: caseId } });
      });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error("E3_DB_SMOKE_FAIL", error.message); process.exitCode = 1; });
