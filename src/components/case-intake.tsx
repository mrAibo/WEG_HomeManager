"use client";

import { useRef, useState } from "react";
import { saveDashboardCaseAction } from "@/server/actions/ai-cases";
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
  const [draft, setDraft] = useState<LocalCaseDraft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);

  function invalidate() {
    setDraft(null);
    setReviewed(false);
    setMessage("");
    setSavedCaseId(null);
  }

  function chooseFile(mode: "photo" | "document", file: File | undefined) {
    setKind(mode);
    setSelected(null);
    invalidate();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setMessage("Die Datei ist größer als 10 MB. Bitte eine kleinere Datei wählen.");
      return;
    }
    const allowed = mode === "photo"
      ? file.type.startsWith("image/")
      : ["application/pdf", "image/png", "image/jpeg"].includes(file.type);
    if (!allowed) {
      setMessage("Bitte ein Foto (JPG/PNG) oder ein PDF auswählen.");
      return;
    }
    // Only metadata is retained in React state; content stays in the native picker.
    setSelected({ name: file.name, size: file.size });
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
        setSavedCaseId(result.caseId);
        setMessage("Vorgang mit Textentwurf gespeichert. Dateien wurden nicht hochgeladen.");
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
          Beschreiben Sie Ihr Anliegen und prüfen Sie den bearbeitbaren Textentwurf.
          {canSave ? "Sie können diesen Vorgang ausdrücklich speichern." : "Speichern ist der Verwaltung vorbehalten."}
          {" "}Keine KI-Auswertung oder Versand.
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
              setKind("question"); setSelected(null); invalidate();
            }}
          >
            <MessageSquare className="size-4" /> Frage stellen
          </Button>
        </div>
        <input
          ref={photoInput} type="file" className="sr-only"
          accept="image/*" capture="environment"
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
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            Ausgewählt: {selected.name} ({Math.ceil(selected.size / 1024)} KB).
            Die Datei wurde <strong>nicht hochgeladen oder ausgewertet</strong>.
          </p>
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
                  Regelbasierte Textvorlage, noch kein KI-Ergebnis. Fotos und Dokumente
                  bleiben lokal und sind nicht Teil des gespeicherten Vorgangs. Kein Versand.
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
        {message && <p role="status" className="text-sm">{message}</p>}
        <p className="text-sm text-muted-foreground">
          {canSave && <><Link href="/cases" className="underline underline-offset-2">Gespeicherte Vorgänge</Link> · </>}
          Bestehende Funktionen: <Link href="/tickets" className="underline underline-offset-2">Tickets</Link>{" "}
          und <Link href="/documents" className="underline underline-offset-2">Dokumente</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
