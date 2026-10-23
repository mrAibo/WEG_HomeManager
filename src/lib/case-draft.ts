// Local-only E2 UI helper. This does NOT call a model, upload evidence or grant approval.
export type CaseInputKind = "photo" | "document" | "question";

export type LocalCaseDraft = {
  subject: string;
  body: string;
};

export function prepareLocalCaseDraft(kind: CaseInputKind, description: string): LocalCaseDraft {
  const detail = description.trim().replace(/\r\n?/g, "\n");
  if (detail.length < 10 || detail.length > 3000) {
    throw new Error("Bitte beschreiben Sie Ihr Anliegen mit 10 bis 3000 Zeichen.");
  }
  const summary = detail.split("\n")[0].replace(/\s+/g, " ").slice(0, 75);
  if (kind === "question") {
    return {
      subject: `Rückfrage: ${summary}`,
      body: `Anliegen:\n${detail}\n\nNoch zu klären:\n- Welche Informationen oder Unterlagen fehlen?\n- Wer ist für die Klärung zuständig?\n\nDies ist eine bearbeitbare interne Notiz. Es wurde keine Antwort durch KI ermittelt.`,
    };
  }
  if (kind === "document") {
    return {
      subject: `Dokumentenprüfung: ${summary}`,
      body: `Bitte prüfen:\n${detail}\n\nPrüfschritte:\n- Gespeicherten Vorgang und angehängte Originaldatei öffnen.\n- Datum, Absender und mögliche Fristen kontrollieren.\n- Zuständigkeit und weiteres Vorgehen bestimmen.\n\nEine gewählte Datei bleibt bis zum ausdrücklichen Speichern nur im Browser. Nach dem Speichern den Dateianhang im Vorgang prüfen.`,
    };
  }
  return {
    subject: `Anfrage zur Schadensprüfung: ${summary}`,
    body: `Guten Tag,\n\nwir bitten um eine Einschätzung und gegebenenfalls ein Angebot zu folgendem Anliegen:\n\n${detail}\n\nBitte teilen Sie uns mögliche Termine, den Leistungsumfang und die voraussichtlichen Kosten mit. Ein Auftrag wird hiermit nicht erteilt.\n\nMit freundlichen Grüßen\n[Name und WEG ergänzen]`,
  };
}
