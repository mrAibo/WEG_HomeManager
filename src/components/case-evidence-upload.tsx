"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCaseEvidenceAction } from "@/server/actions/ai-evidence";

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

export function CaseEvidenceUpload({ caseId }: { caseId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function upload() {
    if (!file || busy.current || saving) return;
    if (file.size > MAX_EVIDENCE_SIZE) {
      setMessage("Datei überschreitet 10 MB.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setMessage("");
    try {
      const data = new FormData();
      data.append("caseId", caseId);
      data.append("file", file);
      const result = await uploadCaseEvidenceAction(data);
      if (!result.ok) {
        setMessage(result.error ?? "Upload fehlgeschlagen.");
      } else {
        window.location.reload();
      }
    } catch {
      setMessage("Upload fehlgeschlagen. Bitte Verbindung prüfen.");
    } finally {
      setSaving(false);
      busy.current = false;
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        PDF, JPG oder PNG bis 10 MB. Die unveränderten Datei-Bytes werden intern
        gespeichert und mit SHA-256 dokumentiert. Formatprüfung vor Speicherung,
        aber noch kein Virenscanner. Nur synthetische Testdateien verwenden.
        KI-Texterkennung erfolgt nur nach separatem Klick und ausdrücklicher Zustimmung.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".pdf,image/jpeg,image/png"
          aria-label="Beweismittel auswählen"
          className="min-w-0 max-w-full text-sm file:mr-3 file:rounded-md file:border file:p-2"
          disabled={saving}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setMessage("");
          }}/>
        <Button type="button" onClick={upload} disabled={!file || saving}>
          <Upload className="size-4" /> {saving ? "Datei wird gespeichert ..." : "Datei hinzufügen"}
        </Button>
      </div>
      {file && <p className="text-xs text-muted-foreground">
        Ausgewählt: {file.name} · {(file.size / 1024).toFixed(0)} KB.
        Upload erfolgt erst nach Klick auf „Datei hinzufügen“.
      </p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  );
}
