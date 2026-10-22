import { describe, expect, it } from "vitest";
import { canApproveCopy, hashProposalContent, hashSourceText, isCurrentCopyApproval } from "./ai-case-policy";

describe("E3 immutable copy approval policy", () => {
  it.each(["ADMIN", "VERWALTER"] as const)("permits human manager %s", (role) => {
    expect(canApproveCopy(role)).toBe(true);
  });
  it.each(["BUCHHALTUNG", "BEIRAT", "EIGENTUEMER", "MIETER", "HANDWERKER"] as const)(
    "denies review privileges to %s", (role) => {
      expect(canApproveCopy(role)).toBe(false);
    },
  );
  it("hashes original source deterministically", () => {
    expect(hashSourceText("Test")).toBe(hashSourceText("Test"));
    expect(hashSourceText("Test")).not.toBe(hashSourceText("Test!"));
  });
  it("binds approval to exact ordered fields", () => {
    const digest = hashProposalContent("Titel", "Inhalt");
    expect(digest).not.toBe(hashProposalContent("Titel ", "Inhalt"));
    expect(digest).not.toBe(hashProposalContent("Inhalt", "Titel"));
  });
  it("accepts only the approved matching copy-only version", () => {
    const proposal = { version: 4, title: "Titel", body: "Inhalt", state: "APPROVED" };
    const approval = { version: 4, contentSha256: hashProposalContent("Titel", "Inhalt"), scope: "COPY_ONLY" };
    expect(isCurrentCopyApproval(proposal, approval)).toBe(true);
    expect(isCurrentCopyApproval({ ...proposal, version: 5 }, approval)).toBe(false);
    expect(isCurrentCopyApproval({ ...proposal, body: "geändert" }, approval)).toBe(false);
    expect(isCurrentCopyApproval({ ...proposal, state: "DRAFT" }, approval)).toBe(false);
    expect(isCurrentCopyApproval(proposal, { ...approval, scope: "SEND_EMAIL" })).toBe(false);
    expect(isCurrentCopyApproval(proposal, null)).toBe(false);
  });
});
