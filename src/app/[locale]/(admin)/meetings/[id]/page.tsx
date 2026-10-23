import { ArrowLeft, X } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { date, decimal } from "@/lib/format";
import { getDateLocale } from "@/lib/date-locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetingDialog, AgendaDialog, ResolutionDialog } from "@/components/meeting-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { reviewMeetingSuggestion } from "@/server/actions/meeting-suggestions";
import { ClipboardCheck, UserRoundCheck } from "lucide-react";
import { deleteMeeting, deleteAgenda, deleteResolution } from "@/server/actions/meetings";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const df = await getDateLocale(locale);

  const meeting = await prisma.meeting.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      property: true,
      agendaItems: { orderBy: { position: "asc" } },
      resolutions: { orderBy: { number: "asc" }, include: { subcommunity: { include: { units: { select: { mea: true } } } } } },
    },
  });
  if (!meeting) notFound();
  const [subcommunities, suggestions] = await Promise.all([
    prisma.subcommunity.findMany({
    where: { tenantId: user.tenantId, propertyId: meeting.propertyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
    }),
    prisma.meetingSuggestion.findMany({
      where: { tenantId: user.tenantId, meetingId: meeting.id },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, title: true, description: true,
        submittedRole: true, status: true, createdAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" render={<Link href="/meetings" />}>
            <ArrowLeft className="size-4" />
            {t("meetings.title")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {meeting.property.name} · {date(meeting.date, df)}
            {meeting.location ? ` · ${meeting.location}` : ""}
          </p>
          <Badge variant={meeting.status === "DURCHGEFUEHRT" ? "secondary" : "outline"}>
            {t(`meetingStatus.${meeting.status}`)}
          </Badge>
        </div>
        <div className="flex gap-1">
          <MeetingDialog
            meeting={{
              id: meeting.id,
              title: meeting.title,
              date: meeting.date,
              location: meeting.location,
              status: meeting.status,
              protocol: meeting.protocol,
            }}
          />
          <DeleteButton action={deleteMeeting} id={meeting.id} />
        </div>
      </div>

      <Card className="border-teal-200 bg-teal-50/30 dark:border-teal-900 dark:bg-teal-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="size-5 text-teal-700"/> Vorbereitung der Versammlung
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Arbeitsliste für die Verwaltung. Die endgültige Einladung, gesetzliche Fristen,
            erforderliche Anlagen und Beschlussformulierungen müssen fachlich geprüft werden.
          </p>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          {[
            "Termin, Ort und Eigentümer-/Kontaktliste prüfen",
            "Wirtschaftsplan, Abrechnung und Rücklagenstand bereitstellen",
            "Angebote, Rechnungen und sonstige Anlagen zusammentragen",
            "Vorschläge von Eigentümern und Bewohnern sichten",
            "Tagesordnung und Entwürfe für Beschlüsse prüfen",
            "Einladung und Fristen vor dem Versand kontrollieren",
            "Anwesenheit, Vollmachten und Protokoll vorbereiten",
            "Ergebnisse und Beschlusssammlung nach dem Termin pflegen",
          ].map(label => (
            <label key={label} className="flex gap-2 rounded-lg border bg-background/80 p-3">
              <input type="checkbox" className="mt-1" aria-label={label}/>
              {label}
            </label>
          ))}
          <p className="col-span-full text-xs text-muted-foreground">
            Diese Checkliste ist eine lokale Orientierung und wird noch nicht dauerhaft gespeichert.
            Dokumente befinden sich im Bereich Dokumente, die eigentliche Tagesordnung unten.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRoundCheck className="size-5 text-teal-700" /> Anregungen aus dem Eigentümer-/Bewohnerportal ({suggestions.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Eingehende Vorschläge sind zunächst nur Wünsche oder Fragen.
            Erst nach einer Entscheidung der Verwaltung wird daraus ein TOP.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!suggestions.length && <p className="text-sm text-muted-foreground">
            Noch keine Anregungen eingegangen. Berechtigte Eigentümer und Bewohner können sie über ihr Portal einreichen.
          </p>}
          {suggestions.map(s => (
            <div key={s.id} className="rounded-xl border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{s.title}</p>
                <Badge variant="outline">
                  {s.status === "NEW" ? "Neu · ungeprüft" :
                    s.status === "ADDED" ? "In Tagesordnung" : "Geprüft · nicht aufgenommen"}
                </Badge>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Eingereicht von: {s.submittedRole === "EIGENTUEMER" ? "Eigentümer" : "Bewohner"} · {date(s.createdAt, df)}
              </p>
              {s.status === "NEW" && meeting.status === "GEPLANT" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={reviewMeetingSuggestion}>
                    <input type="hidden" name="suggestionId" value={s.id}/>
                    <input type="hidden" name="decision" value="ADD"/>
                    <Button size="sm" type="submit">Als TOP übernehmen</Button>
                  </form>
                  <form action={reviewMeetingSuggestion}>
                    <input type="hidden" name="suggestionId" value={s.id}/>
                    <input type="hidden" name="decision" value="NOT_ON_AGENDA"/>
                    <Button size="sm" type="submit" variant="outline">Prüfen, nicht aufnehmen</Button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tagesordnung */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("meetings.agenda")}</CardTitle>
          <AgendaDialog meetingId={meeting.id} />
        </CardHeader>
        <CardContent className="space-y-2">
          {meeting.agendaItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("meetings.noAgenda")}</p>
          ) : (
            meeting.agendaItems.map((a) => (
              <div key={a.id} className="flex items-start justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">TOP {a.position}: {a.title}</span>
                  {a.description ? (
                    <p className="text-muted-foreground">{a.description}</p>
                  ) : null}
                </div>
                <form action={deleteAgenda}>
                  <input type="hidden" name="id" value={a.id} />
                  <Button type="submit" variant="ghost" size="icon" aria-label={t("common.delete")}>
                    <X className="size-4" />
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Beschlüsse */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("meetings.resolutions")}</CardTitle>
          <ResolutionDialog
            propertyId={meeting.propertyId}
            meetingId={meeting.id}
            subcommunities={subcommunities.map((s) => ({ value: s.id, label: s.name }))}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {meeting.resolutions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("meetings.noResolutions")}</p>
          ) : (
            meeting.resolutions.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium">
                      #{r.number} · {r.title}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.text}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.result === "ANGENOMMEN" ? "secondary" : r.result === "ABGELEHNT" ? "destructive" : "outline"}>
                      {t(`resolutionResult.${r.result}`)}
                    </Badge>
                    <DeleteButton action={deleteResolution} id={r.id} />
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {t("meetings.votes")}: {t("meetings.yes")} {r.votesYes} · {t("meetings.no")} {r.votesNo} · {t("meetings.abstain")} {r.votesAbstain}
                  {/* Beschluss einer Untergemeinschaft: nur deren Eigentümer, Nenner = MEA der UG (#42) */}
                  {r.subcommunity && (
                    <>
                      {" · "}
                      {t("weg.votingBasis", {
                        name: r.subcommunity.name,
                        mea: decimal(r.subcommunity.units.reduce((a, u) => a + (u.mea ?? 0), 0), locale),
                      })}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Protokoll */}
      {meeting.protocol ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("meetings.protocol")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{meeting.protocol}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
