// German-first, short and actionable explanations for each inherited HaVeWa module.
// Never claim a workflow is automated when it is not.
export type ModuleHint = { title: string; why: string; firstStep: string };
export const moduleHints: Record<string, ModuleHint> = {
  "/dashboard": { title: "Startseite", why: "Hier beginnt ein neuer Vorgang. Wählen Sie eine Datei oder schreiben Sie Ihr Anliegen.", firstStep: "Dokument wählen oder Aufgabe beschreiben → Speichern → im Vorgang weiterbearbeiten." },
  "/cases": { title: "Gespeicherte Vorgänge", why: "Hier bleiben Ihre hochgeladenen Dateien und bearbeitbaren Entwürfe dauerhaft auffindbar.", firstStep: "Einen Vorgang öffnen, Originaldatei ansehen und gegebenenfalls KI-Texterkennung starten." },
  "/properties": { title: "Immobilien", why: "Alle Häuser und Wohnanlagen, die Sie verwalten.", firstStep: "Zuerst die WEG oder Immobilie anlegen, anschließend Gebäude und Wohnungen zuordnen." },
  "/units": { title: "Wohnungen & Einheiten", why: "Wohnungen, Keller und weitere Einheiten mit Flächen und Miteigentumsanteilen.", firstStep: "Einheit einem Gebäude zuordnen, Wohnfläche und WEG-Anteil überprüfen." },
  "/persons": { title: "Kontakte", why: "Eigentümer, Bewohner, Dienstleister und andere Beteiligte.", firstStep: "Kontakt anlegen und mit Einheit beziehungsweise Eigentümerrolle verbinden." },
  "/leases": { title: "Mietverträge", why: "Verträge und Mietverhältnisse, sofern Ihre Verwaltung Mietobjekte betreut.", firstStep: "Mieter und Wohnung zuordnen, danach Mietvertrag erfassen." },
  "/leasing": { title: "Vermarktung", why: "Vermietungsinteressenten und Objektangebote verwalten.", firstStep: "Nur nötig, wenn Sie Wohnungen vermieten oder vermitteln." },
  "/finances": { title: "Finanzen", why: "Forderungen, Zahlungen und offene Positionen.", firstStep: "Buchungen und Belege überprüfen; keine KI-Zahlungen werden ausgeführt." },
  "/dunning": { title: "Mahnwesen", why: "Offene Zahlungen und vorbereitete Mahnungen.", firstStep: "Beträge vor eventuellen Mahnungen manuell prüfen." },
  "/statements": { title: "Abrechnungen", why: "Abrechnungen für Miet- oder Verwaltungsvorgänge.", firstStep: "Grunddaten und Buchungen vollständig erfassen, anschließend Ergebnisse kontrollieren." },
  "/weg": { title: "WEG-Verwaltung", why: "Miteigentumsanteile, Wirtschaftspläne, Rücklagen und Beschlüsse.", firstStep: "WEG-Objekt und MEA kontrollieren, anschließend Wirtschaftsplan und Rücklage pflegen." },
  "/meetings": { title: "Eigentümerversammlungen", why: "Termine, Tagesordnung, Anträge und Ergebnisse der Versammlung.", firstStep: "Versammlung anlegen, Unterlagen vorbereiten, Vorschläge sichten und Tagesordnung prüfen." },
  "/calendar": { title: "Kalender", why: "Termine, Wartungen und Fristen.", firstStep: "Anstehenden Termin mit Objekt und Beteiligten erfassen." },
  "/tickets": { title: "Instandhaltung", why: "Reparaturmeldungen, Schäden und Nachverfolgung.", firstStep: "Problem erfassen, Verantwortliche bestimmen und Maßnahmen dokumentieren." },
  "/documents": { title: "Dokumentenablage", why: "Geordnete Archivablage für dauerhafte Unterlagen.", firstStep: "Ein Dokument einem Objekt zuordnen. Neue Dateien vom Dashboard zunächst als Vorgang ablegen." },
  "/communication": { title: "Posteingang & Postausgang", why: "E-Mails und Kommunikation mit Beteiligten.", firstStep: "Nachrichten prüfen; Versand nur nach ausdrücklicher Zustimmung." },
  "/insurance": { title: "Versicherungen", why: "Policen, Fristen und Schadensbezüge.", firstStep: "Policen pro WEG erfassen und Laufzeiten kontrollieren." },
  "/grundsteuer": { title: "Grundsteuer", why: "Grundsteuerbezogene Daten und Unterlagen.", firstStep: "Bescheide und Objektangaben vollständig abgleichen." },
  "/zensus": { title: "Zensus", why: "Verwaltungsangaben für statistische Anfragen.", firstStep: "Nur bei entsprechender Anfrage verwenden." },
  "/reports": { title: "Auswertungen", why: "Übersichten und exportierbare Berichte.", firstStep: "Erst Datenbestand prüfen, dann Bericht erstellen." },
  "/templates": { title: "Vorlagen", why: "Textbausteine für wiederkehrende Korrespondenz.", firstStep: "Vorlage auswählen, Inhalt immer persönlich prüfen." },
  "/audit": { title: "Änderungsprotokoll", why: "Wer hat wann welche Änderung vorgenommen?", firstStep: "Bei Fragen einen Vorgang zeitlich nachvollziehen." },
  "/tenants": { title: "Mandanten", why: "Getrennte Organisationen und Berechtigungsbereiche.", firstStep: "Nur für Instanzadministratoren." },
  "/settings": { title: "Einstellungen", why: "Benutzer, Rollen, Mail, KI und Layout konfigurieren.", firstStep: "Zuerst eigene Organisation und Berechtigungen überprüfen." },
};
export function hintForPath(path: string): ModuleHint | null {
  const stripped = path.replace(/^\/(de|en|pt-BR)(?=\/|$)/, "") || "/dashboard";
  const key = Object.keys(moduleHints).filter(x => stripped === x || stripped.startsWith(x + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return key ? moduleHints[key] : null;
}
