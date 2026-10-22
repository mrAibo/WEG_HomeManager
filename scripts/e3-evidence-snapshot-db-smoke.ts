// Local, synthetic-only integrity test. Never targets production.
import { promises as fs } from "node:fs";
import { PDFDocument } from "pdf-lib";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { createLocalCase, submitLocalProposal, approveLocalCopy, getApprovedLocalCopy } from "../src/server/ai-case-workflow";
import { addCaseEvidence } from "../src/server/ai-evidence-workflow";
import { verifyEvidenceSnapshot } from "../src/server/ai-evidence-snapshot";
import { deleteFile } from "../src/lib/storage";

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw Error(msg);
}
async function denied(run: () => Promise<unknown>, reason: string) {
  try { await run(); } catch { return; }
  throw Error(reason + ": expected rejection");
}

async function main() {
  const raw = process.env.DATABASE_URL;
  assert(raw, "DATABASE_URL missing");
  const url = new URL(raw);
  assert(["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.port === "5432" && url.pathname === "/havewa", "Refusing nonlocal test DB");
  const tenant = await prisma.tenant.findFirst({
    where: { name: "WEG Demo – Sechs Wohnungen" }, select: { id: true },
  });
  assert(tenant, "Synthetic tenant required");
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "ADMIN" }, select: { id: true, role: true },
  });
  assert(admin, "Synthetic manager required");
  const actor = { id: admin.id, tenantId: tenant.id, role: admin.role };
  const source = Buffer.from(await (async () => { const pdf = await PDFDocument.create(); pdf.addPage([300, 300]); return pdf.save(); })());
  let createdCase: string | null = null;
  let key: string | null = null;
  try {
    const created = await createLocalCase(actor, {
      kind: "DOCUMENT", summary: "Synthetischer Test für Evidence-Versionen",
      sourceText: "Ein Test ohne echte WEG-Dateien oder personenbezogene Informationen.",
      title: "Manueller Prüfvorschlag", body: "Kein Versand und keine Beauftragung.",
    });
    createdCase = created.caseId;
    const file = await addCaseEvidence(actor, created.caseId, "fixture.pdf", source);
    const row = await prisma.aiEvidence.findFirstOrThrow({
      where: { id: file.id, tenantId: tenant.id },
    });
    key = row.storageKey;
    const expected = await verifyEvidenceSnapshot(tenant.id, created.caseId);
    await submitLocalProposal(actor, created.proposalId, 1);
    const submitted = await prisma.aiProposal.findFirstOrThrow({
      where: { id: created.proposalId, tenantId: tenant.id },
    });
    assert(submitted.evidenceSha256 === expected, "Submission must bind Evidence manifest");

    const disk = path.join(process.cwd(), "storage", "documents", path.basename(key));
    await fs.writeFile(disk, Buffer.from("CORRUPTED"));
    await denied(() => approveLocalCopy(actor, created.proposalId, 1),
      "Corrupt bytes must block approval");
    await fs.writeFile(disk, source);
    const approved = await approveLocalCopy(actor, created.proposalId, 1);
    assert(approved.scope === "COPY_ONLY", "Approval must remain manual copy-only");
    const record = await prisma.aiApproval.findFirstOrThrow({
      where: { proposalId: created.proposalId, version: 1 },
    });
    assert(record.evidenceSha256 === expected, "Approval must record identical manifest");
    const text = await getApprovedLocalCopy(actor, created.proposalId);
    assert(text.title === "Manueller Prüfvorschlag", "Copy must work for intact evidence");

    await fs.writeFile(disk, Buffer.from("CORRUPTED_AFTER_APPROVAL"));
    await denied(() => getApprovedLocalCopy(actor, created.proposalId),
      "Corrupt bytes must block even previously approved copy");
    await fs.writeFile(disk, source);
    const counter = await prisma.aiApproval.count({
      where: { proposalId: created.proposalId, tenantId: tenant.id },
    });
    assert(counter === 1, "Failed approval must not create extra record");
    console.log("E3_SNAPSHOT_DB_PASS: manifest, tamper-before-approval, recovery, tamper-after-approval, copy-only");
  } finally {
    if (createdCase) {
      const scoped = createdCase;
      await prisma.$transaction(async tx => {
        await tx.aiEvidence.deleteMany({ where: { tenantId: tenant.id, caseId: scoped } });
        const proposals = await tx.aiProposal.findMany({
          where: { tenantId: tenant.id, caseId: scoped }, select: { id: true },
        });
        await tx.aiApproval.deleteMany({ where: {
          tenantId: tenant.id, proposalId: { in: proposals.map(p => p.id) },
        } });
        await tx.aiCaseEvent.deleteMany({ where: { tenantId: tenant.id, caseId: scoped } });
        await tx.aiProposal.deleteMany({ where: { tenantId: tenant.id, caseId: scoped } });
        await tx.aiCase.deleteMany({ where: { tenantId: tenant.id, id: scoped } });
      });
    }
    if (key) await deleteFile(key);
    await prisma.$disconnect();
  }
}
main().catch(error => {
  console.error("E3_SNAPSHOT_DB_FAIL", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
