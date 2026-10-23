import { describe, expect, it } from "vitest";
import { prepareLocalCaseDraft } from "./case-draft";

describe("safe local case draft", () => {
  it("prepares an editable request without ordering work", () => {
    const draft = prepareLocalCaseDraft("photo", "Im Treppenhaus tropft Wasser aus der Decke.");
    expect(draft.subject).toContain("Schadensprüfung");
    expect(draft.body).toContain("Ein Auftrag wird hiermit nicht erteilt");
    expect(draft.body).toContain("tropft Wasser");
  });
  it("does not claim document OCR or upload", () => {
    const draft = prepareLocalCaseDraft("document", "Die letzte Abrechnung muss überprüft werden.");
    expect(draft.body).toContain("ausdrücklichen Speichern");
    expect(draft.body).not.toContain("automatisch ausgelesen");
  });
  it("treats questions as internal notes, not fabricated AI answers", () => {
    const draft = prepareLocalCaseDraft("question", "Wann ist unsere nächste Eigentümerversammlung?");
    expect(draft.body).toContain("keine Antwort durch KI ermittelt");
  });
  it("requires meaningful content", () => {
    expect(() => prepareLocalCaseDraft("photo", "kurz")).toThrow();
  });
  it("bounds input size", () => {
    expect(() => prepareLocalCaseDraft("question", "a".repeat(3001))).toThrow();
  });
  it("normalizes first-line subject and retains the full note", () => {
    const draft = prepareLocalCaseDraft("question", "  Wasser im Keller    gefunden\nWeitere Details zur Situation  ");
    expect(draft.subject).not.toContain("\n");
    expect(draft.body).toContain("Weitere Details zur Situation");
  });
});
