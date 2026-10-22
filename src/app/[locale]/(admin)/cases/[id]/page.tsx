import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CaseReview } from "@/components/case-review";
import { CaseEvidenceUpload } from "@/components/case-evidence-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SavedCasePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["VERWALTER"]);
  const { id } = await params;
  if (!id || id.length > 128) notFound();
  const item = await prisma.aiCase.findFirst({
    where: { id, tenantId: user.tenantId },
    select: {
      id: true, summary: true, sourceText: true, sourceSha256: true, kind: true,
      createdAt: true,
      property: { select: { name: true } },
      evidence: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, mime: true, sha256: true, size: true, createdAt: true },
      },
      proposals: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: {
          id: true, version: true, state: true, title: true, body: true,
          origin: true,
        },
      },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 50,
        select: { id: true, action: true, version: true, createdAt: true },
      },
    },
  });
  if (!item) notFound();
  const proposal = item.proposals[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/cases" className="text-sm font-medium underline underline-offset-2">
        ← Zurück zu gespeicherten Vorgängen
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{item.summary}</h1>
        <p className="text-sm text-muted-foreground">
          Erstellt am {item.createdAt.toLocaleDateString("de-DE")} ·
          {" "}{item.property?.name ?? "Kein Objekt zugeordnet"} ·
          {" "}{item.kind === "QUESTION" ? "Frage" : item.kind === "PHOTO" ? "Fotobeschreibung" : "Dokumentenbeschreibung"}
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Ursprüngliche Beschreibung</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap text-sm">{item.sourceText}</p>
          <p className="break-all text-xs text-muted-foreground" title="SHA-256 der ursprünglich eingegebenen Beschreibung">
            SHA-256: {item.sourceSha256}
          </p>
          <p className="text-xs text-muted-foreground">
            Ursprüngliche Textbeschreibung. Hochgeladene Dateien stehen separat unter „Beweismittel“.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-base font-semibold">Beweismittel ({item.evidence.length})</h2></CardHeader>
        <CardContent className="space-y-4">
          {item.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Foto- oder PDF-Dateien hochgeladen.</p>
          ) : (
            <ul className="space-y-3">
              {item.evidence.map((evidence) => (
                <li key={evidence.id} className="min-w-0 rounded-md border p-3 text-sm">
                  <a className="font-medium underline underline-offset-2 break-all"
                    href={`/api/cases/${item.id}/evidence/${evidence.id}`}>
                    {evidence.name} (herunterladen)
                  </a>
                  <p className="text-xs text-muted-foreground">{evidence.mime} · {Math.ceil(evidence.size / 1024)} KB · {evidence.createdAt.toLocaleString("de-DE")}</p>
                  <p className="break-all text-xs text-muted-foreground">SHA-256: {evidence.sha256}</p>
                </li>
              ))}
            </ul>
          )}
          {proposal?.state === "DRAFT" ? (
            <CaseEvidenceUpload caseId={item.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nach Einreichung können keine zusätzlichen Beweismittel angehängt werden.
              Bei neuen Erkenntnissen zuerst einen neuen Vorgang anlegen.
            </p>
          )}
        </CardContent>
      </Card>
      {proposal && (
        <CaseReview
          key={`${proposal.id}:${proposal.version}:${proposal.state}`}
          proposal={proposal}
        />
      )}
      <Card>
        <CardHeader><CardTitle>Verlauf</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {item.events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-none">
                <span className="text-muted-foreground">{event.createdAt.toLocaleString("de-DE")}</span>
                <span>{event.action}</span>
                {event.version && <span className="text-muted-foreground">Version {event.version}</span>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
