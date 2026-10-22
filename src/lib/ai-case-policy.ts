import crypto from "node:crypto";
import type { UserRole } from "@prisma/client";

// Only an authenticated manager or admin may approve internal COPY_ONLY drafts.
// Approval of a draft is NEVER approval to send, contract, book or pay.
export function canApproveCopy(role: UserRole): boolean {
  return role === "ADMIN" || role === "VERWALTER";
}

export function hashSourceText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashProposalContent(title: string, body: string): string {
  // Length-delimited canonical representation avoids delimiter ambiguity.
  return hashSourceText(JSON.stringify([title, body]));
}

export function isCurrentCopyApproval(
  proposal: { version: number; title: string; body: string; state: string; evidenceSha256: string | null },
  approval: { version: number; contentSha256: string; evidenceSha256: string | null; scope: string } | null,
): boolean {
  return proposal.state === "APPROVED" &&
    approval?.scope === "COPY_ONLY" &&
    approval.version === proposal.version &&
    !!proposal.evidenceSha256 &&
    approval.evidenceSha256 === proposal.evidenceSha256 &&
    approval.contentSha256 === hashProposalContent(proposal.title, proposal.body);
}
