import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CaseReview } from "@/components/case-review";
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
            Hier wurde nur der eingegebene Text gespeichert. Foto, Scan oder PDF wurden nicht übertragen.
          </p>
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
