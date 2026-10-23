"use client";

import { useRef, useState } from "react";
import { ScanText, ShieldCheck, ListChecks, TriangleAlert, ArrowUpRight } from "lucide-react";
import { categoryLabels, actionLabels, type DocumentTriage } from "@/lib/ai-document-triage";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  recognizeCaseEvidenceAction, reviewCaseRecognitionAction,
} from "@/server/actions/ai-recognition";

export type RecognitionView = {
  id: string;
  provider: string;
  model: string;
  rawText: string;
  editedText: string | null;
  unclear: string[];
  status: string;
  createdAt: string;
  sourceSha256: string;
  triage?: DocumentTriage | null;
};

export function CaseRecognition({
  caseId, evidenceId, evidenceSha256, enabled, model, provider, recognition, reviewable,
}: {
  caseId: string;
  evidenceId: string;
  evidenceSha256: string;
  enabled: boolean;
  model: string | null;
  provider: string;
  recognition: RecognitionView | null;
  reviewable: boolean;
}) {
  const [agreed, setAgreed] = useState(false);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [text, setText] = useState(recognition?.editedText ?? recognition?.rawText ?? "");
  const [working, setWorking] = useState(false);
  const workingRef = useRef(false);
  const [message, setMessage] = useState("");
  async function perform(run: () => Promise<{ok: boolean;error?: string}>) {
    if (workingRef.current) return;
    workingRef.current = true;
    setWorking(true);
    setMessage("");
    try {
      const result = await run();
      if (!result.ok) {
        setMessage(result.error ?? "Aktion fehlgeschlagen.");
      } else {
        window.location.reload();
      }
    } catch {
      setMessage("Keine Verbindung oder Modell nicht erreichbar. Bitte erneut versuchen.");
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  }
  if (!recognition) {
    return (
      <div className="mt-3 space-y-2 border-t pt-3">
        <p className="text-sm font-semibold">Dokument verstehen lassen (KI, optional)</p>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? `Gewähltes Modell: ${provider} / ${model}. Das Modell muss Bilder bzw. PDF lesen können.`
            : "Zuerst unter Einstellungen → Integrationen eine KI mit Bild-/PDF-Unterstützung konfigurieren."}
        </p>
        <p className="text-xs text-muted-foreground">
          Die KI liest das Original, schlägt eine Dokumentart, wichtige Daten, mögliche Fristen
          und nächste Schritte vor – in einem Durchgang. Bei einem externen Anbieter wird
          das vollständige Original an diesen übertragen. Datenschutz/Kosten prüfen.
          Kein Vorschlag löst automatisch E-Mails, Zahlungen, Beschlüsse oder Aufträge aus.
        </p>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" checked={agreed} disabled={!enabled || working}
            onChange={e => setAgreed(e.target.checked)} className="mt-0.5" />
          Ich stimme zu, dass dieses Dokument an das eingestellte KI-Modell für Texterkennung und Handlungsvorschläge übermittelt wird.
        </label>
        <Button type="button" variant="outline" size="sm"
          disabled={!enabled || !agreed || working}
          onClick={() => perform(() => recognizeCaseEvidenceAction({
            caseId, evidenceId, consent: true,
          }))}>
          <ScanText className="size-4" /> {working ? "Dokument wird analysiert ..." : "Dokument mit KI analysieren"}
        </Button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </div>
    );
  }
  return (
    <section className="mt-3 space-y-3 border-t pt-3" aria-label="KI-Dokumentenanalyse">
      <div>
        <p className="text-sm font-medium">
          KI-Erkennung · {recognition.status === "REVIEWED" ? "menschlich geprüft" : "ungeprüfter Entwurf"}
        </p>
        <p className="text-xs text-muted-foreground">
          {recognition.provider} / {recognition.model}. Die KI kann Text falsch lesen oder ergänzen.
          Nur Original und manuell geprüfte Angaben sind maßgeblich.
        </p>
        {recognition.sourceSha256 !== evidenceSha256 && (
          <p className="text-sm text-destructive">Originaldatei stimmt nicht mehr mit dem Erkennungsergebnis überein.</p>
        )}
        {recognition.unclear.length > 0 && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Unklar: {recognition.unclear.join(" · ")}
          </p>
        )}
      </div>
      {recognition.triage && (
        <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                KI-Einschätzung · nicht geprüft
              </p>
              <h3 className="mt-1 text-lg font-semibold">{categoryLabels[recognition.triage.category]}</h3>
            </div>
            <span className="rounded-full border bg-background px-3 py-1 text-xs">
              KI-Sicherheit: {Math.round(recognition.triage.confidence * 100)} %
            </span>
          </div>
          <p className="text-sm">{recognition.triage.explanation}</p>
          {(recognition.triage.propertyHint || recognition.triage.senderHint || recognition.triage.dueDate) && (
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              {recognition.triage.senderHint && <div><dt className="text-muted-foreground">Möglicher Absender</dt>
                <dd>{recognition.triage.senderHint}</dd></div>}
              {recognition.triage.propertyHint && <div><dt className="text-muted-foreground">Mögliche WEG</dt>
                <dd>{recognition.triage.propertyHint}</dd></div>}
              {recognition.triage.dueDate && <div><dt className="text-muted-foreground">Vermutete Frist</dt>
                <dd>{recognition.triage.dueDate} (manuell prüfen)</dd></div>}
            </dl>
          )}
          {recognition.triage.facts.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold">Erkannte Angaben mit Textbeleg</p>
              {recognition.triage.facts.map((fact, i) => (
                <div key={i} className="rounded-lg border bg-background p-3 text-sm">
                  <p><strong>{fact.label}:</strong> {fact.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Beleg im KI-Text: „{fact.evidence}“</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold"><ListChecks className="size-4"/> Was sollte als Nächstes passieren?</p>
            {recognition.triage.actions.map((action, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                <div className="text-sm">
                  <p className="font-medium">{actionLabels[action.code].label}
                    {action.priority !== "NORMAL" && (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                        {action.priority === "URGENT" ? "Dringlichkeit überprüfen" : "Zeitnah prüfen"}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground">{action.explanation}</p>
                </div>
                <Link href={actionLabels[action.code].href} className="shrink-0 rounded-md border p-2"
                  aria-label={`Zu ${actionLabels[action.code].label}`}
                  title="Bereich öffnen, ohne eine Aktion auszuführen">
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
            ))}
          </div>
          <p className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0"/>
            Unverbindliche Vorschläge der gewählten KI. Original und alle Zahlen, Fristen und
            Zuordnungen selbst prüfen. Die Sicherheit ist nur eine Modellschätzung,
            keine geprüfte Wahrscheinlichkeit. Nach einer Textkorrektur können die Vorschläge veraltet sein.
            Nichts wurde gebucht, verschickt oder zugeordnet.
          </p>
        </div>
      )}
      {!recognition.triage && <p className="text-xs text-muted-foreground">
        Zu dieser älteren Texterkennung liegt keine Dokumenteneinordnung vor.
      </p>}
      <label htmlFor={`recognition-${evidenceId}`} className="block text-xs font-medium">
        Erkannter Text — mit dem herunterladbaren Original vergleichen
      </label>
      <textarea id={`recognition-${evidenceId}`} rows={9} maxLength={20000}
        value={text} disabled={working || recognition.status === "REVIEWED" || !reviewable}
        onChange={e => {setText(e.target.value);setReviewChecked(false);}}
        className="w-full min-w-0 rounded-lg border border-input bg-transparent p-2 text-sm" />
      {recognition.status !== "REVIEWED" && (
        <>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={reviewChecked} disabled={working || !reviewable}
              onChange={e => setReviewChecked(e.target.checked)} className="mt-0.5" />
            Ich habe den Text mit der Originaldatei verglichen und korrigiert.
          </label>
          <Button type="button" size="sm" variant="outline"
            disabled={!reviewable || !reviewChecked || !text.trim() || working || recognition.sourceSha256 !== evidenceSha256}
            onClick={() => perform(() => reviewCaseRecognitionAction({
              recognitionId: recognition.id, correctedText: text,
            }))}>
            <ShieldCheck className="size-4" /> Geprüfte Transkription speichern
          </Button>
        </>
      )}
      {recognition.status === "REVIEWED" && (
        <p className="text-xs text-muted-foreground">
          Menschliche Prüfung gespeichert. Dadurch werden weder Angebote freigegeben,
          noch Zahlungen, Nachrichten oder Aufträge ausgelöst.
        </p>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}
