"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { MAX_EVIDENCE_SIZE } from "@/lib/ai-evidence-policy";
import { addCaseEvidence } from "@/server/ai-evidence-workflow";
import { CaseWorkflowError } from "@/server/ai-case-workflow";

export type EvidenceActionResult = { ok: boolean; error?: string; evidenceId?: string };

export async function uploadCaseEvidenceAction(form: FormData): Promise<EvidenceActionResult> {
  const user = await requireRole(["VERWALTER"]);
  if (user.role !== "ADMIN" && user.role !== "VERWALTER") {
    return { ok: false, error: "Keine Berechtigung." };
  }
  const caseId = form.get("caseId");
  const file = form.get("file");
  if (typeof caseId !== "string" || !caseId || caseId.length > 128) {
    return { ok: false, error: "Ungültiger Vorgang." };
  }
  if (!(file instanceof File) || !file.name || file.size === 0) {
    return { ok: false, error: "Bitte wählen Sie eine Datei aus." };
  }
  if (file.size > MAX_EVIDENCE_SIZE) {
    return { ok: false, error: "Datei überschreitet 10 MB." };
  }

  try {
    const evidence = await addCaseEvidence(
      { id: user.id, tenantId: user.tenantId, role: user.role },
      caseId, file.name, Buffer.from(await file.arrayBuffer()),
    );
    revalidatePath(`/cases/${caseId}`);
    return { ok: true, evidenceId: evidence.id };
  } catch (error) {
    if (error instanceof CaseWorkflowError) return { ok: false, error: error.message };
    return { ok: false, error: "Datei konnte nicht sicher gespeichert werden." };
  }
}
