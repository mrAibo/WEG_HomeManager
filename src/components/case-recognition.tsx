"use client";

import { useRef, useState } from "react";
import { ScanText, ShieldCheck } from "lucide-react";
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
        <p className="text-xs font-medium">KI-Texterkennung (optional)</p>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? `Gewähltes Modell: ${provider} / ${model}. Das Modell muss Bilder bzw. PDF lesen können.`
            : "Zuerst unter Einstellungen → Integrationen eine KI mit Bild-/PDF-Unterstützung konfigurieren."}
        </p>
        <p className="text-xs text-muted-foreground">
          Bei einem externen KI-Anbieter wird das vollständige Originaldokument an diesen Dienst übertragen.
          Datenschutz und mögliche Kosten vorher prüfen. Keine automatische Weiterverarbeitung.
        </p>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" checked={agreed} disabled={!enabled || working}
            onChange={e => setAgreed(e.target.checked)} className="mt-0.5" />
          Ich möchte dieses Dokument ausdrücklich mit dem eingestellten KI-Modell erkennen lassen.
        </label>
        <Button type="button" variant="outline" size="sm"
          disabled={!enabled || !agreed || working}
          onClick={() => perform(() => recognizeCaseEvidenceAction({
            caseId, evidenceId, consent: true,
          }))}>
          <ScanText className="size-4" /> {working ? "Erkennung läuft ..." : "Text mit KI erkennen"}
        </Button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </div>
    );
  }
  return (
    <section className="mt-3 space-y-3 border-t pt-3" aria-label="KI-Texterkennung">
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
