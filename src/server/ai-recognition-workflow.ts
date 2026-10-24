// Evidence recognition is a separate UNTRUSTED draft; no AI-origin proposals,
// automatic accounting records, mail, contractor action or financial changes.
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";
import { evidenceHash } from "@/lib/ai-evidence-policy";
import { triageSchema, validateTriageEvidence } from "@/lib/ai-document-triage";
import { canApproveCopy } from "@/lib/ai-case-policy";
import { CaseWorkflowError } from "@/lib/ai-case-errors";
import {
  recognizeDocument, type RecognitionDocument, type RecognitionSettings, type Transcription,
} from "@/lib/ai-document-recognition";
import type { CaseActor } from "./ai-case-workflow";

type Recognizer = (document: RecognitionDocument, settings: RecognitionSettings) => Promise<Transcription>;

function manager(actor: CaseActor) {
  if (!actor.id || !actor.tenantId || !canApproveCopy(actor.role)) {
    throw new CaseWorkflowError("Keine Berechtigung zur Dokumenterkennung.");
  }
}
const permittedMimes = ["application/pdf", "image/jpeg", "image/png"] as const;

export async function recognizeSavedEvidence(
  actor: CaseActor,
  caseId: string,
  evidenceId: string,
  consent: boolean,
  recognizer: Recognizer = recognizeDocument,
) {
  manager(actor);
  if (!consent) throw new CaseWorkflowError("Bitte Übertragung an den gewählten KI-Dienst ausdrücklich bestätigen.");
  if (!caseId || !evidenceId || caseId.length > 128 || evidenceId.length > 128)
    throw new CaseWorkflowError("Ungültige Dokumentkennung.");

  const [row, tenant, proposal] = await Promise.all([
    prisma.aiEvidence.findFirst({
      where: { id: evidenceId, caseId, tenantId: actor.tenantId },
      select: { id: true, caseId: true, storageKey: true, size: true, sha256: true, mime: true, name: true },
    }),
    prisma.tenant.findUnique({
      where: { id: actor.tenantId },
      select: { aiProvider: true, aiModel: true, aiApiKey: true, aiBaseUrl: true },
    }),
    prisma.aiProposal.findFirst({
      where: { tenantId: actor.tenantId, caseId }, select: { state: true },
    }),
  ]);
  if (!row) throw new CaseWorkflowError("Beweismittel nicht gefunden.");
  if (proposal?.state !== "DRAFT") throw new CaseWorkflowError("Erkennung nur für offene Entwürfe erlaubt.");
  if (await prisma.aiRecognition.findUnique({ where: { evidenceId: row.id }, select: { id: true } }))
    throw new CaseWorkflowError("Für dieses Beweismittel gibt es bereits eine Erkennung.");
  const provider = tenant?.aiProvider ?? (tenant?.aiBaseUrl ? "openai" : "anthropic");
  const model = tenant?.aiModel?.trim();
  const apiKey = tenant?.aiApiKey?.trim();
  if ((provider !== "openai" && provider !== "anthropic") || !model || !apiKey) {
    throw new CaseWorkflowError("KI-Modell, Anbieter und API-Zugang zuerst unter Einstellungen → Integrationen festlegen.");
  }
  if (!permittedMimes.includes(row.mime as typeof permittedMimes[number])) {
    throw new CaseWorkflowError("Dateityp nicht für KI-Erkennung zugelassen.");
  }
  let bytes: Buffer;
  try { bytes = await readFile(row.storageKey); }
  catch { throw new CaseWorkflowError("Beweismittel fehlt. KI-Erkennung blockiert."); }
  if (bytes.length !== row.size || evidenceHash(bytes) !== row.sha256) {
    throw new CaseWorkflowError("Beweismittel wurde verändert. KI-Erkennung blockiert.");
  }
  const settings: RecognitionSettings = {
    provider, model, apiKey, baseUrl: tenant?.aiBaseUrl,
  };
  const result = await recognizer({
    bytes, mime: row.mime as RecognitionDocument["mime"], name: row.name,
  }, settings);

  // A remote inference is untrusted and can race an upload or human review.
  // Re-check saved bytes and DRAFT state after returning, before committing.
  let unchanged: Buffer;
  try { unchanged = await readFile(row.storageKey); }
  catch { throw new CaseWorkflowError("Originaldatei nach der Erkennung nicht mehr verfügbar."); }
  if (unchanged.length !== row.size || evidenceHash(unchanged) !== row.sha256)
    throw new CaseWorkflowError("Originaldatei hat sich während der Erkennung verändert.");
  if (!result.text.trim() || result.text.length > 20000 || result.unclear.length > 30)
    throw new CaseWorkflowError("KI-Antwort ist ungültig oder zu lang.");
  // Validate here too: injected recognizers or other backends cannot persist
  // unknown action codes or ungrounded fact quotations.
  const triage = result.triage ? triageSchema.safeParse(result.triage) : null;
  if (triage && !triage.success) throw new CaseWorkflowError("KI-Einordnung hat ein ungültiges Format.");
  if (triage?.success) {
    try { validateTriageEvidence(triage.data, result.text); }
    catch { throw new CaseWorkflowError("KI-Angaben sind nicht durch Textstellen belegt."); }
  }

  return prisma.$transaction(async (tx) => {
    // Lock the proposal row via conditional UPDATE, serializing against review.
    const locked = await tx.aiProposal.updateMany({
      where: { tenantId: actor.tenantId, caseId, state: "DRAFT" },
      data: { updatedAt: new Date() },
    });
    if (locked.count !== 1) throw new CaseWorkflowError("Vorgang wurde inzwischen zur Prüfung eingereicht.");
    const current = await tx.aiEvidence.findFirst({
      where: { tenantId: actor.tenantId, caseId, id: evidenceId, sha256: row.sha256, size: row.size },
    });
    if (!current) throw new CaseWorkflowError("Beweismittel inzwischen verändert.");
    const saved = await tx.aiRecognition.create({
      data: {
        tenantId: actor.tenantId, caseId, evidenceId: row.id, sourceSha256: row.sha256,
        provider, model, rawText: result.text, unclear: result.unclear,
        triage: triage?.success ? triage.data : undefined,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await tx.aiCaseEvent.create({
      data: { tenantId: actor.tenantId, caseId, actorId: actor.id, action: "recognition_generated" },
    });
    return saved;
  });
}

export async function reviewSavedRecognition(
  actor: CaseActor, recognitionId: string, corrected: string,
) {
  manager(actor);
  if (!recognitionId || recognitionId.length > 128 || !corrected.trim() || corrected.length > 20000)
    throw new CaseWorkflowError("Bitte einen gültigen korrigierten Text angeben.");
  const existing = await prisma.aiRecognition.findFirst({
    where: { id: recognitionId, tenantId: actor.tenantId },
    select: { caseId: true, evidenceId: true, sourceSha256: true, status: true },
  });
  if (!existing || existing.status !== "DRAFT") throw new CaseWorkflowError("Erkennung bereits geprüft oder nicht gefunden.");
  const row = await prisma.aiEvidence.findFirst({
    where: { id: existing.evidenceId, tenantId: actor.tenantId, caseId: existing.caseId },
    select: { sha256: true, storageKey: true },
  });
  if (!row || row.sha256 !== existing.sourceSha256)
    throw new CaseWorkflowError("Originaldatei stimmt nicht mehr mit der Erkennung überein.");
  let actual: Buffer;
  try { actual = await readFile(row.storageKey); }
  catch { throw new CaseWorkflowError("Originaldatei nicht verfügbar."); }
  if (evidenceHash(actual) !== existing.sourceSha256)
    throw new CaseWorkflowError("Originaldatei wurde verändert.");
  return prisma.$transaction(async (tx) => {
    const draft = await tx.aiProposal.updateMany({
      where: { tenantId: actor.tenantId, caseId: existing.caseId, state: "DRAFT" },
      data: { updatedAt: new Date() },
    });
    if (draft.count !== 1) throw new CaseWorkflowError("Erkennung kann nach Einreichung nicht mehr bestätigt werden.");
    const updated = await tx.aiRecognition.updateMany({
      where: { id: recognitionId, tenantId: actor.tenantId, status: "DRAFT" },
      data: { editedText: corrected.trim(), status: "REVIEWED",
        reviewedById: actor.id, reviewedAt: new Date() },
    });
    if (updated.count !== 1) throw new CaseWorkflowError("Erkennung bereits geprüft.");
    await tx.aiCaseEvent.create({
      data: { tenantId: actor.tenantId, caseId: existing.caseId, actorId: actor.id,
        action: "recognition_human_reviewed" },
    });
    return { status: "REVIEWED" as const };
  });
}
