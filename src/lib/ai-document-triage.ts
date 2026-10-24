import { z } from "zod";

// Bounded, read-only suggestions: an LLM cannot issue arbitrary URLs,
// commands, DB changes, e-mail, payments or legal decisions.
export const triageSchema = z.object({
  category: z.enum([
    "INVOICE", "REMINDER", "CONTRACT", "INSURANCE", "BANK",
    "WEG_INVITATION", "MEETING_MINUTES", "MEETING_PROPOSAL",
    "OWNER_REQUEST", "TECHNICAL_REPORT", "GOVERNMENT_NOTICE",
    "CORRESPONDENCE", "OTHER", "UNKNOWN",
  ]),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(3).max(400),
  senderHint: z.string().max(120).nullable(),
  propertyHint: z.string().max(160).nullable(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  facts: z.array(z.object({
    label: z.string().min(1).max(70),
    value: z.string().min(1).max(180),
    evidence: z.string().min(1).max(160),
  }).strict()).max(8),
  actions: z.array(z.object({
    code: z.enum([
      "REVIEW_DOCUMENT", "CHECK_DEADLINE", "VERIFY_INVOICE",
      "ASSIGN_PROPERTY", "FILE_DOCUMENT", "MEETING_AGENDA_REVIEW",
      "DRAFT_REPLY", "REQUEST_INFORMATION", "ESCALATE_TO_MANAGER",
    ]),
    explanation: z.string().min(5).max(240),
    priority: z.enum(["NORMAL", "SOON", "URGENT"]),
  }).strict()).min(1).max(5),
}).strict();

export type DocumentTriage = z.infer<typeof triageSchema>;

export const categoryLabels: Record<DocumentTriage["category"], string> = {
  INVOICE: "Rechnung",
  REMINDER: "Mahnung / Zahlungserinnerung",
  CONTRACT: "Vertrag",
  INSURANCE: "Versicherungsunterlage",
  BANK: "Bankunterlage",
  WEG_INVITATION: "Einladung zur Eigentümerversammlung",
  MEETING_MINUTES: "Versammlungsprotokoll",
  MEETING_PROPOSAL: "Antrag / Vorschlag zur Versammlung",
  OWNER_REQUEST: "Anliegen von Eigentümer oder Bewohner",
  TECHNICAL_REPORT: "Technischer Bericht / Schadensmeldung",
  GOVERNMENT_NOTICE: "Behördlicher Bescheid",
  CORRESPONDENCE: "Schriftverkehr",
  OTHER: "Sonstiges Dokument",
  UNKNOWN: "Nicht sicher erkannt",
};

export const actionLabels: Record<DocumentTriage["actions"][number]["code"], {label:string; href:string}> = {
  REVIEW_DOCUMENT: {label:"Original und Erkennung prüfen",href:"/cases"},
  CHECK_DEADLINE: {label:"Frist manuell kontrollieren",href:"/calendar"},
  VERIFY_INVOICE: {label:"Rechnungsdaten gegen Original prüfen",href:"/finances"},
  ASSIGN_PROPERTY: {label:"WEG / Objekt zuordnen",href:"/properties"},
  FILE_DOCUMENT: {label:"Nach Prüfung in Dokumentenablage übernehmen",href:"/documents"},
  MEETING_AGENDA_REVIEW: {label:"Vorschlag für Tagesordnung prüfen",href:"/meetings"},
  DRAFT_REPLY: {label:"Antwortentwurf vorbereiten",href:"/communication"},
  REQUEST_INFORMATION: {label:"Fehlende Angaben klären",href:"/cases"},
  ESCALATE_TO_MANAGER: {label:"Priorität durch Verwaltung prüfen",href:"/cases"},
};

/**
 * Accept only facts with exact evidence spans from the literal transcription.
 * Model-proposed context without evidence remains an unconfirmed suggestion.
 * No server action is derived from the untrusted result.
 */
export function validateTriageEvidence(triage: DocumentTriage, text: string): DocumentTriage {
  if (triage.facts.some(f => !text.includes(f.evidence))) {
    throw new Error("KI-Fakten müssen durch ein wörtliches Textzitat belegt sein.");
  }
  return triage;
}
