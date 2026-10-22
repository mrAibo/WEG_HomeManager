"use client";

import { useRef, useState } from "react";
import { ClipboardCopy, ShieldCheck } from "lucide-react";
import {
  approveSavedCaseCopyAction,
  fetchApprovedCaseCopyAction,
  reviseSavedCaseAction,
  submitSavedCaseAction,
  type CaseActionResult,
} from "@/server/actions/ai-cases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Proposal = {
  id: string;
  version: number;
  title: string;
  body: string;
  state: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  origin: "TEMPLATE" | "MODEL";
};

const labels: Record<Proposal["state"], string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "Zur Prüfung eingereicht",
  APPROVED: "Nur zum Kopieren freigegeben",
  REJECTED: "Abgelehnt",
};

export function CaseReview({ proposal }: { proposal: Proposal }) {
  const [title, setTitle] = useState(proposal.title);
  const [body, setBody] = useState(proposal.body);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [message, setMessage] = useState("");
  const dirty = title !== proposal.title || body !== proposal.body;
  const nonempty = title.trim().length > 0 && body.trim().length > 0;
  const idAndVersion = { proposalId: proposal.id, expectedVersion: proposal.version };

  async function run(task: () => Promise<CaseActionResult>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await task();
      if (!result.ok) {
        setMessage(result.error ?? "Aktion fehlgeschlagen.");
      } else {
        setChecked(false);
        // A hard navigation guarantees fresh DB state after a committed write.
        // Client router cache may temporarily show the previous proposal version.
        window.location.reload();
      }
    } catch {
      setMessage("Aktion fehlgeschlagen. Bitte neu laden.");
    } finally {
      setPending(false);
      busy.current = false;
    }
  }

  async function copyCurrentApproved() {
    if (busy.current || dirty || proposal.state !== "APPROVED") return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      // Read the exact currently approved version from the database, not from
      // untrusted/stale browser props or a local checkbox.
      const result = await fetchApprovedCaseCopyAction({ proposalId: proposal.id });
      if (!result.ok || !result.approved || result.approved.version !== proposal.version) {
        setMessage(result.error ?? "Freigabe veraltet. Bitte Seite neu laden.");
        return;
      }
      await navigator.clipboard.writeText(`${result.approved.title}\n\n${result.approved.body}`);
      setMessage("Freigegebenen Text kopiert. Es wurde nichts versendet oder beauftragt.");
    } catch {
      setMessage("Kopieren nicht möglich. Bitte Browserberechtigungen prüfen.");
    } finally {
      setPending(false);
      busy.current = false;
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>Bearbeitbares Angebot / Schreiben</CardTitle>
        <p className="text-sm text-muted-foreground">
          {labels[proposal.state]} · Version {proposal.version} ·{" "}
          {proposal.origin === "TEMPLATE" ? "Regelbasierte Vorlage" : "KI-Vorschlag"}
        </p>
        <p className="text-xs text-muted-foreground">
          Diese Freigabe ist ausschließlich für manuelles Kopieren gültig.
          Es werden keine Nachrichten verschickt, Aufträge erteilt oder Zahlungen ausgelöst.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="case-proposal-title" className="text-sm font-medium">Betreff</label>
          <Input id="case-proposal-title" value={title} maxLength={160}
            disabled={pending || proposal.state === "REJECTED"}
            onChange={(event) => {
              setTitle(event.target.value);
              setChecked(false);
              setMessage("");
            }}/>
        </div>
        <div className="space-y-2">
          <label htmlFor="case-proposal-body" className="text-sm font-medium">Text</label>
          <textarea id="case-proposal-body" value={body} rows={10} maxLength={12000}
            disabled={pending || proposal.state === "REJECTED"}
            onChange={(event) => {
              setBody(event.target.value);
              setChecked(false);
              setMessage("");
            }}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"/>
        </div>
        {dirty && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Ungespeicherte Änderung. Eine bisherige Freigabe gilt nicht für diese Fassung.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {proposal.state !== "REJECTED" && (
            <Button type="button" variant="outline" disabled={pending || !dirty || !nonempty}
              onClick={() => run(
                () => reviseSavedCaseAction({ ...idAndVersion, title, body }),
              )}>
              Änderungen speichern
            </Button>
          )}
          {proposal.state === "DRAFT" && (
            <Button type="button" disabled={pending || dirty}
              onClick={() => run(
                () => submitSavedCaseAction(idAndVersion),
              )}>
              Zur Prüfung einreichen
            </Button>
          )}
        </div>
        {proposal.state === "IN_REVIEW" && (
          <section className="space-y-3 rounded-lg border p-4" aria-label="Freigabe">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={checked} disabled={pending || dirty}
                onChange={(event) => setChecked(event.target.checked)}
                className="mt-1 size-4 shrink-0" />
              Ich habe die genaue Version {proposal.version} persönlich geprüft.
              Ich bestätige ausschließlich die Freigabe zum manuellen Kopieren.
            </label>
            <Button type="button" disabled={pending || !checked || dirty}
              onClick={() => run(
                () => approveSavedCaseCopyAction(idAndVersion),
              )}>
              <ShieldCheck className="size-4" /> Diese Version freigeben
            </Button>
          </section>
        )}
        {proposal.state === "APPROVED" && (
          <Button type="button" disabled={pending || dirty} onClick={copyCurrentApproved}>
            <ClipboardCopy className="size-4" /> Freigegebene Version kopieren
          </Button>
        )}
        {message && <p role="status" className="text-sm">{message}</p>}
      </CardContent>
    </Card>
  );
}
