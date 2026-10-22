// Bind human-reviewed proposals to the exact Evidence set and bytes.
// This is integrity verification, not PDF malware or structural validation.
import { prisma } from "@/lib/prisma";
import { hashSourceText } from "@/lib/ai-case-policy";
import { evidenceHash } from "@/lib/ai-evidence-policy";
import { readFile } from "@/lib/storage";
import { CaseWorkflowError } from "@/lib/ai-case-errors";

type SnapshotRow = {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  storageKey: string;
};

export const MAX_CASE_EVIDENCE = 10;

export function manifestHash(rows: readonly Pick<SnapshotRow, "id" | "name" | "mime" | "size" | "sha256">[]): string {
  // Canonical ordering and fixed-length JSON encoding, independent of DB query order.
  return hashSourceText(JSON.stringify(rows.map(row => [
    row.id, row.name, row.mime, row.size, row.sha256,
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]), "en"))));
}

export async function verifyEvidenceSnapshot(
  tenantId: string, caseId: string,
): Promise<string> {
  const rows: SnapshotRow[] = await prisma.aiEvidence.findMany({
    where: { tenantId, caseId },
    select: { id: true, name: true, mime: true, size: true, sha256: true, storageKey: true },
    orderBy: { id: "asc" },
    take: MAX_CASE_EVIDENCE + 1,
  });
  if (rows.length > MAX_CASE_EVIDENCE) {
    throw new CaseWorkflowError("Zu viele Beweismittel. Maximal zehn Dateien zulässig.");
  }
  for (const item of rows) {
    let actual: Buffer;
    try {
      actual = await readFile(item.storageKey);
    } catch {
      throw new CaseWorkflowError("Beweismittel nicht verfügbar. Freigabe blockiert.");
    }
    if (actual.length !== item.size || evidenceHash(actual) !== item.sha256) {
      throw new CaseWorkflowError("Integritätsprüfung eines Beweismittels fehlgeschlagen.");
    }
  }
  return manifestHash(rows);
}
