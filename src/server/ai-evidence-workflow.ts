// Server-only Evidence storage: no OCR, parsing, AI calls or external publication.
// The caller must derive actor identity from Auth.js (never browser parameters).
import { prisma } from "@/lib/prisma";
import { canApproveCopy } from "@/lib/ai-case-policy";
import {
  evidenceHash, identifyEvidence, safeEvidenceName, MAX_EVIDENCE_SIZE,
} from "@/lib/ai-evidence-policy";
import { saveFile, deleteFile } from "@/lib/storage";
import { CaseWorkflowError } from "@/lib/ai-case-errors";
import { MAX_CASE_EVIDENCE } from "@/server/ai-evidence-snapshot";
import type { CaseActor } from "@/server/ai-case-workflow";

export async function addCaseEvidence(
  actor: CaseActor, caseId: string, originalName: string, buffer: Buffer,
): Promise<{ id: string; name: string; mime: string; sha256: string; size: number }> {
  if (!actor.id || !actor.tenantId || !canApproveCopy(actor.role)) {
    throw new CaseWorkflowError("Keine Berechtigung.");
  }
  if (!caseId || caseId.length > 128 || !originalName || originalName.length > 255) {
    throw new CaseWorkflowError("Ungültige Datei- oder Vorgangsangaben.");
  }
  if (buffer.length === 0 || buffer.length > MAX_EVIDENCE_SIZE) {
    throw new CaseWorkflowError("Dateigröße muss zwischen 1 Byte und 10 MB liegen.");
  }
  const format = identifyEvidence(buffer);
  if (!format) {
    throw new CaseWorkflowError("Nur PDF, JPG und PNG mit gültiger Dateisignatur zulässig.");
  }
  const name = safeEvidenceName(originalName, format.ext);
  const sha256 = evidenceHash(buffer);
  const scope = { id: caseId, tenantId: actor.tenantId };

  // Fail before writing any disk bytes if the case belongs to another tenant,
  // or if any proposal is already in_review/approved/rejected.
  const target = await prisma.aiCase.findFirst({
    where: scope,
    select: {
      id: true,
      proposals: { select: { state: true } },
    },
  });
  if (!target) throw new CaseWorkflowError("Vorgang nicht gefunden.");
  if (target.proposals.length !== 1 || target.proposals[0].state !== "DRAFT") {
    throw new CaseWorkflowError("Nach Einreichung oder Freigabe können keine Dateien ergänzt werden.");
  }
  const existing = await prisma.aiEvidence.findFirst({
    where: { tenantId: actor.tenantId, caseId, sha256 }, select: { id: true },
  });
  if (existing) throw new CaseWorkflowError("Diese Datei ist bereits angehängt.");

  // Store validated bytes under a random key, with trusted extension.
  const key = await saveFile(buffer, name);
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Conditional update acquires a proposal row lock. Concurrent submission
      // cannot silently approve or submit a case while bytes are attached.
      const locked = await tx.aiProposal.updateMany({
        where: { tenantId: actor.tenantId, caseId, state: "DRAFT" },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new CaseWorkflowError("Der Vorgang wurde zwischenzeitlich eingereicht. Bitte neu laden.");
      }
      const count = await tx.aiEvidence.count({ where: { tenantId: actor.tenantId, caseId } });
      if (count >= MAX_CASE_EVIDENCE) {
        throw new CaseWorkflowError("Maximal zehn Beweismittel je Vorgang zulässig.");
      }
      const row = await tx.aiEvidence.create({
        data: {
          tenantId: actor.tenantId, caseId, name, mime: format.mime,
          size: buffer.length, sha256, storageKey: key,
          uploadedById: actor.id,
        },
        select: { id: true, name: true, mime: true, sha256: true, size: true },
      });
      await tx.aiCaseEvent.create({
        data: {
          tenantId: actor.tenantId, caseId, actorId: actor.id,
          action: "evidence_added",
        },
      });
      return row;
    });
    return created;
  } catch (error) {
    // DB failures or duplicate uploads must never leave silent orphan files.
    try { await deleteFile(key); } catch { /* Removal failure requires operational cleanup */ }
    throw error;
  }
}
