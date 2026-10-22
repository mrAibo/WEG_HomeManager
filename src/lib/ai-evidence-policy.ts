import { createHash } from "node:crypto";

export const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

export type EvidenceFormat = { mime: "application/pdf" | "image/jpeg" | "image/png"; ext: ".pdf" | ".jpg" | ".png" };

function isPng(data: Buffer): boolean {
  const head = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const tail = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  return data.length >= 45 && data.subarray(0, 8).equals(head) &&
    data.subarray(data.length - 12).equals(tail);
}

export function identifyEvidence(data: Buffer): EvidenceFormat | null {
  if (data.length === 0 || data.length > MAX_EVIDENCE_SIZE) return null;
  if (isPng(data)) return { mime: "image/png", ext: ".png" };
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 &&
      data[2] === 0xff && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  if (data.length >= 12 && data.subarray(0, 5).toString("ascii") === "%PDF-" &&
      data.subarray(Math.max(0, data.length - 1024)).includes(Buffer.from("%%EOF"))) {
    return { mime: "application/pdf", ext: ".pdf" };
  }
  return null;
}

export function safeEvidenceName(name: string, ext: EvidenceFormat["ext"]): string {
  const sanitized = name.replace(/[\\/\x00-\x1f\x7f"<>:|?*]/g, "_").trim().slice(0, 120);
  const base = sanitized.replace(/\.(pdf|png|jpe?g)$/i, "").trim().slice(0, 110);
  return (base || "Dokument") + ext;
}

export function evidenceHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
