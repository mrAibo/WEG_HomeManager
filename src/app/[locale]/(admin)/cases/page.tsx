import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS: Record<string, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "Zur Prüfung",
  APPROVED: "Für Kopieren freigegeben",
  REJECTED: "Abgelehnt",
};

export default async function CasesPage() {
  const user = await requireRole(["VERWALTER"]);
  const cases = await prisma.aiCase.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true, kind: true, summary: true, createdAt: true,
      _count: { select: { evidence: true } },
      property: { select: { name: true } },
      proposals: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { state: true, version: true },
      },
    },
  });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Gespeicherte Vorgänge</h1>
        <p className="text-sm text-muted-foreground">
          Hier finden Sie dauerhaft gespeicherte Dokumente, Fotos und Fragen.
          Klicken Sie einen Vorgang an, um den Originalanhang und den Textentwurf zu öffnen.
          Keine automatischen Aufträge, Zahlungen oder E-Mails.
        </p>
        <Link href="/dashboard" className="text-sm font-medium underline underline-offset-2">
          Neuen Vorgang auf dem Dashboard vorbereiten
        </Link>
      </div>
      {cases.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Noch keine gespeicherten Vorgänge vorhanden.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {cases.map((item) => (
            <Link key={item.id} href={`/cases/${item.id}`}
              className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Card className="transition-colors hover:bg-muted/30">
                <CardHeader>
                  <CardTitle>{item.summary}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{item._count.evidence} gespeicherte Datei(en)</span>
                  <span>{item.kind === "PHOTO" ? "Fotobeschreibung" :
                    item.kind === "DOCUMENT" ? "Dokumentenbeschreibung" : "Frage"}</span>
                  <span>{item.property?.name ?? "Noch keinem Objekt zugeordnet"}</span>
                  <span>{item.proposals[0] ? STATUS[item.proposals[0].state] : "Ohne Entwurf"}</span>
                  <span>{item.createdAt.toLocaleDateString("de-DE")}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
