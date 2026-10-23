import { describe, it, expect } from "vitest";
import { triageSchema, validateTriageEvidence, categoryLabels, actionLabels } from "./ai-document-triage";

export const validTriage = {
  category: "INVOICE", confidence: 0.81,
  explanation: "Rechnung mit einem Gesamtbetrag.",
  senderHint: "Demo GmbH", propertyHint: null,
  documentDate: null, dueDate: null,
  facts: [{ label: "Gesamt", value: "47,20 €", evidence: "Gesamtbetrag 47,20 €" }],
  actions: [
    { code: "VERIFY_INVOICE", explanation: "Betrag und Rechnungspartner prüfen", priority: "NORMAL" },
    { code: "ASSIGN_PROPERTY", explanation: "Objekt zuordnen, bevor archiviert wird", priority: "SOON" },
  ],
} as const;

describe("AI document triage is a bounded, read-only recommendation", () => {
  it("parses model suggestions and exact supporting source text", () => {
    const value=triageSchema.parse(validTriage);
    expect(validateTriageEvidence(value,"Rechnung - Gesamtbetrag 47,20 €")).toEqual(value);
    expect(categoryLabels[value.category]).toBe("Rechnung");
    expect(actionLabels[value.actions[0].code].href).toBe("/finances");
  });
  it("rejects hallucinated evidence quotes", () => {
    const value=triageSchema.parse(validTriage);
    expect(()=>validateTriageEvidence(value,"Absolut kein Geldbetrag enthalten")).toThrow(/belegt/);
  });
  it("does not permit arbitrary commands, APIs or model URLs as action codes", () => {
    expect(triageSchema.safeParse({
      ...validTriage, actions: [{code:"SEND_EMAIL", explanation:"Mail sofort senden", priority:"URGENT"}],
    }).success).toBe(false);
    expect(triageSchema.safeParse({...validTriage, sendMoney:true}).success).toBe(false);
    expect(triageSchema.safeParse({...validTriage,confidence:2}).success).toBe(false);
  });
  it("bounds output and refuses unspecific due-date formats", () => {
    expect(triageSchema.safeParse({...validTriage,dueDate:"morgen"}).success).toBe(false);
    expect(triageSchema.safeParse({...validTriage,actions:[]}).success).toBe(false);
    expect(triageSchema.safeParse({...validTriage,facts:Array(12).fill(validTriage.facts[0])}).success).toBe(false);
  });
});
