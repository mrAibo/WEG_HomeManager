"use client";

import { useRef, useState } from "react";
import { saveDashboardCaseAction } from "@/server/actions/ai-cases";
import { uploadCaseEvidenceAction } from "@/server/actions/ai-evidence";
import { Camera, FileText, MessageSquare, ClipboardCopy, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prepareLocalCaseDraft, type CaseInputKind, type LocalCaseDraft } from "@/lib/case-draft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Case text may be saved with explicit user action; file contents are NEVER uploaded.
export function CaseIntake({ canSave = false }: { canSave?: boolean }) {
  const photoInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<CaseInputKind>("question");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null);
  const selectedFile = useRef<File | null>(null);
  const [draft, setDraft] = useState<LocalCaseDraft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "saved" | "failed">("idle");
  const saveLock = useRef(false);
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);

  function invalidate() {
    setDraft(null);
    setReviewed(false);
    setMessage("");
    setSavedCaseId(null);
    setUploadStatus("idle");
  }

  function chooseFile(mode: "photo" | "document", file: File | undefined) {
    setKind(mode);
    setSelected(null);
    selectedFile.current = null;
    invalidate();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setMessage("Die Datei ist größer als 10 MB. Bitte eine kleinere Datei wählen.");
      return;
    }
    const allowed = mode === "photo"
      ? ["image/png", "image/jpeg"].includes(file.type)
      : ["application/pdf", "image/png", "image/jpeg"].includes(file.type);
    if (!allowed) {
      setMessage("Bitte ein Foto (JPG/PNG) oder ein PDF auswählen.");
      return;
    }
    // Only metadata is retained in React state; content stays in the native picker.
    setSelected({ name: file.name, size: file.size });
    selectedFile.current = file;
  }

  function prepare() {
    try {
      setDraft(prepareLocalCaseDraft(kind, description));
      setSavedCaseId(null);
      setReviewed(false);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bitte Eingabe überprüfen.");
    }
  }

  // Quick document filing: one explicit action creates a durable Case AND
  // attempts an Evidence upload. Picking a file never claims it was saved.
  async function storeSelectedDocument() {
    const file = selectedFile.current;
    if (!canSave || !file || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setUploadStatus("idle");
    setMessage("Speichere den Vorgang und prüfe die Datei ...");
    try {
      const cleanName = file.name.replace(/[\\/\r\n]/g, " ").slice(0, 120);
      const detail = description.trim().length >= 10
        ? description.trim()
        : `Eingehendes Dokument: ${cleanName}. Bitte Inhalt und Zuordnung prüfen.`;
      const created = await saveDashboardCaseAction({
        kind: kind === "photo" ? "PHOTO" : "DOCUMENT",
        description: detail,
        title: `Dokument prüfen: ${cleanName}`.slice(0, 160),
        body: `Eingang: ${cleanName}\n\nBeschreibung: ${detail}\n\nNächste Schritte: Originaldatei prüfen, WEG zuordnen und ggf. die KI-Texterkennung separat starten.\n\nKeine Nachricht oder Zahlung wurde ausgelöst.`,
      });
      if (!created.ok || !created.caseId) {
        setMessage(created.error ?? "Vorgang konnte nicht gespeichert werden.");
        setUploadStatus("failed");
        return;
      }
      const fd = new FormData();
      fd.set("caseId", created.caseId);
      fd.set("file", file);
      const uploaded = await uploadCaseEvidenceAction(fd).catch(() => ({
        ok: false, error: "Die Übertragung ist fehlgeschlagen.",
      }));
      setSavedCaseId(created.caseId);
      if (uploaded.ok) {
        selectedFile.current = null;
        setSelected(null);
        if (documentInput.current) documentInput.current.value = "";
        if (photoInput.current) photoInput.current.value = "";
        setUploadStatus("saved");
        setMessage("Dokument dauerhaft im Vorgang gespeichert. Es wurde weder an KI gesendet noch veröffentlicht.");
      } else {
        setUploadStatus("failed");
        setMessage(`Vorgang wurde erstellt, aber die Datei NICHT gespeichert: ${uploaded.error ?? "Bitte im Vorgang erneut hochladen."}`);
      }
    } catch {
      setUploadStatus("failed");
      setMessage("Speichern fehlgeschlagen. Bitte Gespeicherte Vorgänge auf mögliche Teil-Erfolge prüfen.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function saveCase() {
    if (!canSave || !reviewed || !draft || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setMessage("");
    try {
      const result = await saveDashboardCaseAction({
        kind: kind === "photo" ? "PHOTO" : kind === "document" ? "DOCUMENT" : "QUESTION",
        description,
        title: draft.subject,
        body: draft.body,
      });
      if (result.ok && result.caseId) {
        const file = selectedFile.current;
        if (file) {
          const form = new FormData();
          form.set("caseId", result.caseId);
          form.set("file", file);
          const uploaded = await uploadCaseEvidenceAction(form).catch(() => ({
            ok: false, error: "Netzwerkfehler. Bitte Datei im gespeicherten Vorgang erneut auswählen.",
          }));
          selectedFile.current = null;
          setSelected(null);
          setMessage(uploaded.ok
            ? "Vorgang mit Entwurf und Beweismittel gespeichert. Nichts wurde versendet."
            : "Vorgang gespeichert, aber Datei nicht hochgeladen: " +
              (uploaded.error ?? "Bitte Vorgang öffnen und Datei erneut auswählen."));
        } else {
          setMessage("Vorgang mit Textentwurf gespeichert. Keine Datei hochgeladen.");
        }
        // Expose the Case link only AFTER the attempted Evidence upload finishes.
        // Otherwise navigation races the child parser and shows zero attachments.
        setSavedCaseId(result.caseId);
      } else {
        setMessage(result.error ?? "Vorgang konnte nicht gespeichert werden.");
      }
    } catch {
      setMessage("Vorgang konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  }

  async function copyDraft() {
    if (!reviewed || !draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setMessage("Entwurf kopiert. Sie können ihn selbst weiterverwenden. Nichts wurde versendet.");
    } catch {
      setMessage("Kopieren nicht möglich. Bitte den Text manuell markieren.");
    }
  }

  return (
    <Card className="border-primary/25" aria-labelledby="weg-intake-title">
      <CardHeader className="space-y-2">
        <h2 id="weg-intake-title" className="text-xl font-semibold sm:text-2xl">
          Was kann ich für Sie erledigen?
        </h2>
        <p className="text-sm text-muted-foreground">
          Beginnen Sie mit einer Datei oder Frage. Eine Dateiauswahl allein speichert noch nichts.
          Dokumente lassen sich mit einem Klick in einem dauerhaften Vorgang ablegen;
          für Fragen können Sie zunächst einen Textentwurf vorbereiten. Keine automatische KI oder E-Mail.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3" aria-label="Art des Anliegens">
          <Button
            type="button" variant={kind === "photo" ? "default" : "outline"}
            className="min-h-11" onClick={() => photoInput.current?.click()}
          >
            <Camera className="size-4" /> Foto aufnehmen
          </Button>
          <Button
            type="button" variant={kind === "document" ? "default" : "outline"}
            className="min-h-11" onClick={() => documentInput.current?.click()}
          >
            <FileText className="size-4" /> Dokument auswählen
          </Button>
          <Button
            type="button" variant={kind === "question" ? "default" : "outline"}
            className="min-h-11" onClick={() => {
              setKind("question"); setSelected(null); selectedFile.current = null; invalidate();
            }}
          >
            <MessageSquare className="size-4" /> Frage stellen
          </Button>
        </div>
        <input
          ref={photoInput} type="file" className="sr-only"
          accept="image/jpeg,image/png" capture="environment"
          aria-label="Foto für das Anliegen auswählen"
          onChange={(event) => chooseFile("photo", event.target.files?.[0])}
        />
        <input
          ref={documentInput} type="file" className="sr-only"
          accept=".pdf,image/jpeg,image/png"
          aria-label="Dokument für das Anliegen auswählen"
          onChange={(event) => chooseFile("document", event.target.files?.[0])}
        />
        {selected && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm text-slate-800 dark:border-teal-800 dark:bg-teal-950/30 dark:text-slate-100">
            Ausgewählt: {selected.name} ({Math.ceil(selected.size / 1024)} KB).
            {canSave ? (
              <>Noch nicht gespeichert. Klicken Sie unten auf „Dokument jetzt ablegen“.
              Danach finden Sie die Datei jederzeit unter „Gespeicherte Vorgänge“.</>
            ) : (
              <>Die Datei wird für diese Rolle nicht hochgeladen.</>
            )}
          </div>
        )}
        {selected && canSave && !savedCaseId && (
          <Button type="button" className="w-full min-h-12 sm:w-auto" onClick={storeSelectedDocument} disabled={saving}>
            <FileText className="size-4" />
            {saving ? "Datei wird geprüft und gespeichert ..." : "Dokument jetzt ablegen"}
          </Button>
        )}
        <div className="space-y-2">
          <label htmlFor="weg-case-description" className="text-sm font-medium">
            {kind === "question" ? "Ihre Frage" : "Was ist passiert oder was soll geprüft werden?"}
          </label>
          <textarea
            id="weg-case-description"
            value={description}
            maxLength={3000}
            onChange={(event) => { setDescription(event.target.value); invalidate(); }}
            placeholder="Zum Beispiel: Im Treppenhaus tropft Wasser aus der Decke ..."
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <p className="text-xs text-muted-foreground">
            Mindestens 10 Zeichen. Bitte keine Passwörter oder sensiblen Personendaten eingeben.
          </p>
        </div>
        <Button type="button" onClick={prepare} disabled={description.trim().length < 10}>
          Entwurf vorbereiten
        </Button>

        {draft && (
          <section aria-label="Entwurf überprüfen" className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Entwurf prüfen und bearbeiten</h3>
                <p className="text-sm text-muted-foreground">
                  Regelbasierte Textvorlage, noch kein KI-Ergebnis. Ausgewählte Dateien
                  werden bei ausdrücklichem Speichern zum Vorgang hinzugefügt. Kein Versand.
                </p>
              </div>
            </div>
            <label htmlFor="weg-case-subject" className="block text-sm font-medium">Betreff</label>
            <Input
              id="weg-case-subject" value={draft.subject} maxLength={160} disabled={!!savedCaseId}
              onChange={(event) => {
                setDraft({ ...draft, subject: event.target.value }); setReviewed(false); setMessage("");
              }}
            />
            <label htmlFor="weg-case-body" className="block text-sm font-medium">Entwurfstext</label>
            <textarea
              id="weg-case-body" value={draft.body} rows={9} disabled={!!savedCaseId}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onChange={(event) => {
                setDraft({ ...draft, body: event.target.value }); setReviewed(false); setMessage("");
              }}
            />
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox" className="mt-1 size-4 shrink-0"
                checked={reviewed} onChange={(event) => setReviewed(event.target.checked)}
              />
              Ich habe diese Version geprüft und möchte den Text selbst kopieren.
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!reviewed || !draft.subject.trim() || !draft.body.trim()} onClick={copyDraft}>
                <ClipboardCopy className="size-4" /> Geprüften Entwurf kopieren
              </Button>
              {canSave && (
                <Button type="button" variant="outline"
                  disabled={!reviewed || saving || !!savedCaseId || !draft.subject.trim() || !draft.body.trim()}
                  onClick={saveCase}>
                  {saving ? "Speichert ..." : savedCaseId ? "Gespeichert" : "Vorgang speichern"}
                </Button>
              )}
            </div>
            {savedCaseId && (
              <Link href={`/cases/${savedCaseId}`} className="text-sm font-medium underline underline-offset-2">
                Gespeicherten Vorgang öffnen
              </Link>
            )}
          </section>
        )}
        {message && (
          <div role="status" aria-live="polite"
            className={`rounded-xl border px-4 py-3 text-sm ${uploadStatus === "saved"
              ? "border-teal-300 bg-teal-50 text-teal-900 dark:bg-teal-950/30 dark:text-teal-200"
              : uploadStatus === "failed"
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              : "bg-muted/50"}`}>
            <p>{message}</p>
            {savedCaseId && (
              <Link href={`/cases/${savedCaseId}`} className="mt-2 inline-block font-semibold underline underline-offset-2">
                {uploadStatus === "saved" ? "Gespeichertes Dokument öffnen →" : "Vorgang öffnen und Datei erneut hochladen →"}
              </Link>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {canSave && <><Link href="/cases" className="underline underline-offset-2">Gespeicherte Vorgänge</Link> · </>}
          Bestehende Funktionen: <Link href="/tickets" className="underline underline-offset-2">Tickets</Link>{" "}
          und <Link href="/documents" className="underline underline-offset-2">Dokumente</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
