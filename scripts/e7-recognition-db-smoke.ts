/**
 * Synthetic-only no-network integration: real Case+Evidence+recognition persistence.
 * Mock recognizer ensures NO external model/API request or actual customer data.
 */
import { prisma } from "../src/lib/prisma";
import { createLocalCase } from "../src/server/ai-case-workflow";
import { addCaseEvidence } from "../src/server/ai-evidence-workflow";
import { recognizeSavedEvidence, reviewSavedRecognition } from "../src/server/ai-recognition-workflow";
import { deleteFile } from "../src/lib/storage";
import { PDFDocument } from "pdf-lib";
import type { RecognitionDocument, RecognitionSettings } from "../src/lib/ai-document-recognition";

function expect(ok: unknown, msg: string): asserts ok { if (!ok) throw Error(msg); }
async function mustReject(job: () => Promise<unknown>, label: string) {
  try { await job(); throw new Error("UNEXPECTED_SUCCESS:" + label); }
  catch (e) { if (String(e).includes("UNEXPECTED_SUCCESS")) throw e; }
}

async function main() {
  const u = new URL(process.env.DATABASE_URL ?? "");
  expect(["127.0.0.1", "localhost"].includes(u.hostname) &&
    u.port === "5432" && u.pathname === "/havewa", "Synthetic loopback DB required");
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, aiProvider: true, aiModel: true, aiBaseUrl: true, aiApiKey: true },
  });
  expect(tenants.length === 1 && tenants[0].name === "WEG Demo – Sechs Wohnungen",
    "Unexpected tenant; refusing to test");
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, tenantId: true } });
  expect(users.length > 0 && users.every(x => x.email.endsWith(".invalid")),
    "Unexpected real user; refusing to test");
  const admin = users.find(x => x.role === "ADMIN" && x.tenantId === tenants[0].id);
  expect(admin, "Demo admin required");
  const actor = { id: admin.id, tenantId: admin.tenantId, role: admin.role };
  const original = tenants[0];
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 300]);
  const bytes = Buffer.from(await pdf.save());
  let caseId: string | undefined;
  let key: string | undefined;
  try {
    await prisma.tenant.update({
      where: { id: actor.tenantId },
      data: { aiProvider: "openai", aiModel: "any-user-model", aiApiKey: "SYNTHETIC_ONLY_DO_NOT_SEND", aiBaseUrl: null },
    });
    const { caseId: id } = await createLocalCase(actor, {
      kind: "DOCUMENT", summary: "Nur synthetisches KI-Erkennungs-Testdokument",
      sourceText: "Nur synthetischer Test. Keine echten Personendaten enthalten.",
      title: "Testentwurf", body: "Keine externen Aktionen",
    });
    caseId = id;
    const evidence = await addCaseEvidence(actor, id, "fake.pdf", bytes);
    const row = await prisma.aiEvidence.findUniqueOrThrow({ where: { id: evidence.id } });
    key = row.storageKey;
    await mustReject(() => recognizeSavedEvidence(actor, id, evidence.id, false), "no consent");
    let calls = 0;
    const fake = async (file: RecognitionDocument, config: RecognitionSettings) => {
      calls++;
      expect(file.bytes.equals(bytes) && config.model === "any-user-model",
        "Adapter receives exact selected model and original bytes");
      return { text: "Rechnung Nr. [unleserlich]\nGesamtbetrag 47,20 €",
        unclear: ["Rechnungsnummer unleserlich"] };
    };
    await recognizeSavedEvidence(actor, id, evidence.id, true, fake);
    expect(calls === 1, "Exactly one mock recognition call");
    const recognition = await prisma.aiRecognition.findUniqueOrThrow({ where: { evidenceId: evidence.id } });
    expect(recognition.status === "DRAFT" && recognition.sourceSha256 === row.sha256 &&
      recognition.provider === "openai" && recognition.model === "any-user-model",
      "Recognition must be separate untrusted persistent draft bound to original");
    await mustReject(() => recognizeSavedEvidence(actor, id, evidence.id, true, fake), "duplicate model request");
    expect(calls === 1, "Duplicate must be denied before provider invocation");
    await reviewSavedRecognition(actor, recognition.id,
      "Rechnung Nr. [unleserlich]\nGesamtbetrag 47,20 € (manuell bestätigt)");
    const reviewed = await prisma.aiRecognition.findUniqueOrThrow({ where: { evidenceId: evidence.id } });
    expect(reviewed.status === "REVIEWED" && reviewed.reviewedById === actor.id &&
      reviewed.editedText?.includes("manuell bestätigt"), "Human revision must be durable");
    await mustReject(() => reviewSavedRecognition(actor, recognition.id, "another review"),
      "double confirm must fail");
    const related = await prisma.aiCaseEvent.findMany({
      where: { tenantId: actor.tenantId, caseId: id },
    });
    expect(related.some(e => e.action === "recognition_generated") &&
      related.some(e => e.action === "recognition_human_reviewed"), "Audit events missing");
    const proposal = await prisma.aiProposal.findFirstOrThrow({ where: { caseId: id } });
    expect(proposal.state === "DRAFT" && proposal.origin === "TEMPLATE" &&
      proposal.body === "Keine externen Aktionen", "Model must never mutate proposal/approve/send");
    console.log("E7_RECOGNITION_DB_PASS: no-network chosen model, original SHA, correction, audit, no auto approval");
  } finally {
    if (caseId) {
      const id = caseId;
      await prisma.$transaction(async tx => {
        await tx.aiRecognition.deleteMany({ where: { tenantId: actor.tenantId, caseId: id } });
        await tx.aiCaseEvent.deleteMany({ where: { tenantId: actor.tenantId, caseId: id } });
        await tx.aiEvidence.deleteMany({ where: { tenantId: actor.tenantId, caseId: id } });
        await tx.aiProposal.deleteMany({ where: { tenantId: actor.tenantId, caseId: id } });
        await tx.aiCase.deleteMany({ where: { tenantId: actor.tenantId, id } });
      });
      if (key) await deleteFile(key);
    }
    await prisma.tenant.update({ where: { id: actor.tenantId },
      data: { aiProvider: original.aiProvider, aiModel: original.aiModel,
        aiApiKey: original.aiApiKey, aiBaseUrl: original.aiBaseUrl } });
    await prisma.$disconnect();
  }
}
main().catch(err => { console.error("E7_RECOGNITION_DB_FAIL:", err.message); process.exitCode = 1; });
