"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { CaseWorkflowError } from "@/lib/ai-case-errors";
import { RecognitionError } from "@/lib/ai-document-recognition";
import { recognizeSavedEvidence, reviewSavedRecognition } from "@/server/ai-recognition-workflow";

const requestSchema = z.object({
  caseId: z.string().min(1).max(128),
  evidenceId: z.string().min(1).max(128),
  consent: z.literal(true),
});
const reviewSchema = z.object({
  recognitionId: z.string().min(1).max(128),
  correctedText: z.string().trim().min(1).max(20000),
});
export type RecognitionActionResult = { ok: boolean; error?: string };

function failed(error: unknown): RecognitionActionResult {
  if (error instanceof CaseWorkflowError || error instanceof RecognitionError)
    return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: "Bitte Eingaben überprüfen." };
  return { ok: false, error: "KI-Erkennung derzeit nicht verfügbar. Keine Dokumentdaten verändert." };
}

export async function recognizeCaseEvidenceAction(raw: z.input<typeof requestSchema>): Promise<RecognitionActionResult> {
  const user = await requireRole(["VERWALTER"]);
  if (user.role !== "ADMIN" && user.role !== "VERWALTER") return { ok: false, error: "Keine Berechtigung." };
  try {
    const input = requestSchema.parse(raw);
    await recognizeSavedEvidence({ id: user.id, tenantId: user.tenantId, role: user.role },
      input.caseId, input.evidenceId, input.consent);
    revalidatePath(`/cases/${input.caseId}`);
    return { ok: true };
  } catch (error) { return failed(error); }
}

export async function reviewCaseRecognitionAction(raw: z.input<typeof reviewSchema>): Promise<RecognitionActionResult> {
  const user = await requireRole(["VERWALTER"]);
  if (user.role !== "ADMIN" && user.role !== "VERWALTER") return { ok: false, error: "Keine Berechtigung." };
  try {
    const input = reviewSchema.parse(raw);
    const saved = await reviewSavedRecognition(
      { id: user.id, tenantId: user.tenantId, role: user.role }, input.recognitionId, input.correctedText,
    );
    if (saved.status !== "REVIEWED") return { ok: false, error: "Keine Bestätigung gespeichert." };
    // Page is reloaded by client after review, no background send/approval.
    revalidatePath("/cases");
    return { ok: true };
  } catch (error) { return failed(error); }
}
