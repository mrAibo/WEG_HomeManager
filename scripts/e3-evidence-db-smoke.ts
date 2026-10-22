// Synthetic local DB + storage integration. No real WEG data. Removes its own file and rows.
import { prisma } from "../src/lib/prisma";
import { createLocalCase, submitLocalProposal } from "../src/server/ai-case-workflow";
import { addCaseEvidence } from "../src/server/ai-evidence-workflow";
import { evidenceHash } from "../src/lib/ai-evidence-policy";
import { readFile, deleteFile } from "../src/lib/storage";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function rejects(operation: () => Promise<unknown>, label: string) {
  try { await operation(); } catch { return; }
  throw new Error(label + " unexpectedly succeeded");
}

async function main() {
  const raw = process.env.DATABASE_URL;
  assert(raw, "DATABASE_URL missing");
  const db = new URL(raw);
  assert(["127.0.0.1", "localhost"].includes(db.hostname) &&
    db.port === "5432" && db.pathname === "/havewa", "Refuse nonlocal DB");

  const tenant = await prisma.tenant.findFirst({
    where: { name: "WEG Demo – Sechs Wohnungen" }, select: { id: true },
  });
  assert(tenant, "Synthetic tenant missing");
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "ADMIN" }, select: { id: true, role: true },
  });
  assert(user, "Synthetic ADMIN missing");
  const actor = { id: user.id, tenantId: tenant.id, role: user.role };
  const file = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

  let caseId: string | null = null;
  let storageKey: string | null = null;
  try {
    const created = await createLocalCase(actor, {
      kind: "DOCUMENT",
      summary: "Synthetisches Dokument für sichere Upload-Tests",
      sourceText: "Testbeschreibung ohne echte personenbezogene Daten.",
      title: "Prüfung der Beispielanlage",
      body: "Nur interner Entwurf. Keine Nachricht, Zahlung oder Beauftragung.",
    });
    caseId = created.caseId;

    await rejects(() => addCaseEvidence({ ...actor, tenantId: "foreign" }, created.caseId, "test.pdf", file),
      "Foreign tenant");
    await rejects(() => addCaseEvidence({ ...actor, role: "BUCHHALTUNG" }, created.caseId, "test.pdf", file),
      "Non-manager");
    await rejects(() => addCaseEvidence(actor, created.caseId, "script.pdf",
      Buffer.from("<script>alert(1)</script>")), "Script data");

    const evidence = await addCaseEvidence(actor, created.caseId, "../Synthetisch.pdf", file);
    assert(evidence.mime === "application/pdf" && evidence.sha256 === evidenceHash(file),
      "Evidence digest and MIME must match validated bytes");
    const stored = await prisma.aiEvidence.findFirstOrThrow({
      where: { id: evidence.id, tenantId: actor.tenantId, caseId: created.caseId },
    });
    storageKey = stored.storageKey;
    assert((await readFile(stored.storageKey)).equals(file), "Stored evidence bytes mismatch");
    await rejects(() => addCaseEvidence(actor, created.caseId, "duplicate.pdf", file),
      "Identical evidence duplicate");
    const events = await prisma.aiCaseEvent.findMany({
      where: { tenantId: actor.tenantId, caseId: created.caseId },
    });
    assert(events.filter(e => e.action === "evidence_added").length === 1,
      "Exactly one audit event for one evidence upload");

    await submitLocalProposal(actor, created.proposalId, 1);
    await rejects(() => addCaseEvidence(actor, created.caseId, "late.pdf",
      Buffer.from("%PDF-1.4\nnew file\n%%EOF\n")), "Post-review attachment");
    const count = await prisma.aiEvidence.count({ where: { caseId: created.caseId, tenantId: tenant.id } });
    assert(count === 1, "Only one verified evidence object may exist");
    console.log("E3_EVIDENCE_DB_PASS: tenant, RBAC, MIME, SHA256, stored bytes, duplicate, audit, review lock");
  } finally {
    const caseToDelete = caseId;
    if (caseToDelete) {
      await prisma.$transaction(async (tx) => {
        await tx.aiEvidence.deleteMany({ where: { caseId: caseToDelete, tenantId: tenant.id } });
        const proposals = await tx.aiProposal.findMany({
          where: { caseId: caseToDelete, tenantId: tenant.id }, select: { id: true },
        });
        await tx.aiApproval.deleteMany({
          where: { tenantId: tenant.id, proposalId: { in: proposals.map(p => p.id) } },
        });
        await tx.aiCaseEvent.deleteMany({ where: { caseId: caseToDelete, tenantId: tenant.id } });
        await tx.aiProposal.deleteMany({ where: { caseId: caseToDelete, tenantId: tenant.id } });
        await tx.aiCase.deleteMany({ where: { id: caseToDelete, tenantId: tenant.id } });
      });
    }
    if (storageKey) await deleteFile(storageKey);
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error("E3_EVIDENCE_DB_FAILED", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
