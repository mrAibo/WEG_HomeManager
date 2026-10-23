import { getTranslations, getLocale } from "next-intl/server";
import { Plus, MessageSquarePlus } from "lucide-react";
import { submitMeetingSuggestion } from "@/server/actions/meeting-suggestions";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money, date, decimal } from "@/lib/format";
import { getDateLocale } from "@/lib/date-locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, TextAreaField } from "@/components/form-fields";
import { reportIssue } from "@/server/actions/portal";

export default async function PortalPage({ searchParams }: {
  searchParams: Promise<{ anregung?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const df = await getDateLocale(locale);

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  const personId = dbUser?.personId ?? "__none__";

  const [renters, owners] = await Promise.all([
    prisma.renter.findMany({
      where: { tenantId: user.tenantId, personId },
      include: {
        lease: {
          include: {
            unit: { include: { building: { include: { property: true } } } },
            components: true,
            charges: { include: { payments: { select: { id: true, amount: true, date: true } } }, orderBy: { dueDate: "desc" } },
          },
        },
      },
    }),
    prisma.owner.findMany({
      where: { tenantId: user.tenantId, personId },
      include: { unit: { include: { building: { include: { property: true } } } } },
    }),
  ]);

  const propertyIds = Array.from(
    new Set([
      ...renters.map((r) => r.lease.unit.building.propertyId),
      ...owners.map((o) => o.unit.building.propertyId),
    ]),
  );

  const [resolutions, documents, plannedMeetings, mySuggestions] = await Promise.all([
    propertyIds.length
      ? prisma.resolution.findMany({
          where: { tenantId: user.tenantId, propertyId: { in: propertyIds } },
          orderBy: { number: "asc" },
          include: { subcommunity: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // Datenschutz: nur ausdrücklich dieser Person zugeordnete Dokumente. Objekt-/
    // Wohnungs-Dokumente ohne Personenbezug (Steuer, Versicherung, Kauf …) bleiben
    // intern und werden im Portal nicht angezeigt.
    dbUser?.personId
      ? prisma.document.findMany({ where: { tenantId: user.tenantId, personId: dbUser.personId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    (user.role === "EIGENTUEMER" ? owners.length > 0 : renters.length > 0)
      ? prisma.meeting.findMany({
          where: { tenantId: user.tenantId, propertyId: { in: user.role === "EIGENTUEMER"
            ? owners.map(o => o.unit.building.propertyId)
            : renters.map(r => r.lease.unit.building.propertyId) }, status: "GEPLANT" },
          include: { property: { select: { name: true } } },
          orderBy: { date: "asc" }, take: 15,
        })
      : Promise.resolve([]),
    prisma.meetingSuggestion.findMany({
      where: { tenantId: user.tenantId, submittedById: user.id },
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
  ]);

  const myTickets = await prisma.ticket.findMany({
    where: { tenantId: user.tenantId, reporterId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const openItems = renters.flatMap((r) =>
    r.lease.charges
      .map((c) => {
        const paid = c.payments.reduce((a, p) => a + Number(p.amount), 0);
        return { c, open: Number(c.amount) - paid };
      })
      .filter((x) => x.open > 0.001),
  );

  // Zahlungsverlauf: NUR tatsächlich erfasste Zahlungen (nicht offene Posten,
  // die stehen bereits unter „Offene Posten") — #37.
  const paymentHistory = renters
    .flatMap((r) =>
      r.lease.charges.flatMap((c) =>
        c.payments.map((p) => ({ id: p.id, date: p.date, amount: Number(p.amount), type: c.type })),
      ),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const warm = (l: (typeof renters)[number]["lease"]) =>
    Number(l.rentCold) + l.components.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("portal.welcome")}, {user.name}
        </h1>
        <p className="text-sm text-muted-foreground">{t(`userRole.${user.role}`)}</p>
      </div>

      {(user.role === "EIGENTUEMER" || user.role === "MIETER") && (
        <Card className="border-teal-200 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquarePlus className="size-5 text-teal-700" />
              Vorschlag oder Bitte für die nächste Versammlung
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Eigentümer und Bewohner können Themen, Fragen und Anregungen einreichen.
              Die Verwaltung prüft sie. Eine Einreichung wird nicht automatisch zur Tagesordnung
              oder zu einem Beschluss.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {sp.anregung === "eingereicht" && (
              <p role="status" className="rounded-lg border border-teal-300 bg-white p-3 text-sm text-teal-900">
                Anregung gespeichert. Die Verwaltung kann sie jetzt prüfen.
              </p>
            )}
            {plannedMeetings.length ? (
              <form action={submitMeetingSuggestion} className="grid max-w-xl gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  Versammlung
                  <select name="meetingId" required className="rounded-lg border border-input bg-background p-2">
                    {plannedMeetings.map(m => (
                      <option key={m.id} value={m.id}>{m.property.name} · {m.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Ihr Thema
                  <input name="title" required minLength={5} maxLength={160}
                    placeholder="z. B. Beleuchtung im Treppenhaus"
                    className="rounded-lg border border-input bg-background p-2" />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Worum geht es?
                  <textarea name="description" required minLength={10} maxLength={2500} rows={3}
                    placeholder="Beschreiben Sie Ihren Vorschlag oder Ihre Frage."
                    className="rounded-lg border border-input bg-background p-2"/>
                </label>
                <Button type="submit" className="w-fit">Anregung zur Prüfung einreichen</Button>
              </form>
            ) : <p className="text-sm text-muted-foreground">
              Zurzeit ist für Ihre verknüpfte Immobilie keine geplante Versammlung hinterlegt.
              Für dringende Anliegen nutzen Sie bitte die normale Kontaktaufnahme.
            </p>}
            {mySuggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Meine bisherigen Anregungen</p>
                {mySuggestions.map(s => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 text-sm">
                    <span>{s.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.status === "NEW" ? "Eingegangen · Prüfung offen" :
                        s.status === "ADDED" ? "In die Tagesordnung übernommen" : "Geprüft · nicht auf der Tagesordnung"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mieter: Mietverhältnisse */}
      {renters.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("portal.myLeases")}</CardTitle>
            <CrudDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  {t("portal.report")}
                </Button>
              }
              title={t("portal.report")}
              action={reportIssue}
              submitLabel={t("common.create")}
            >
              <TextField name="title" label={t("portal.issueTitle")} />
              <TextAreaField name="description" label={t("rentComponent.note")} />
            </CrudDialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {renters.map((r) => (
              <div key={r.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-medium">
                  {r.lease.unit.building.property.name} · {r.lease.unit.label}
                </div>
                <div className="text-muted-foreground">
                  {t("leases.warmRent")}: {money(warm(r.lease), locale)} · {t("leases.start")}: {date(r.lease.startDate, df)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mieter: eigene Schadensmeldungen + Status */}
      {myTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.myTickets")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myTickets.map((tk) => (
              <div key={tk.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{tk.title}</div>
                  <div className="text-xs text-muted-foreground">{date(tk.createdAt, df)}</div>
                </div>
                <Badge variant={tk.status === "ERLEDIGT" ? "secondary" : "outline"}>
                  {t(`ticketStatus.${tk.status}`)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mieter: offene Posten */}
      {renters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.myOpenItems")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noOpenItems")}</p>
            ) : (
              openItems.map(({ c, open }) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(`chargeType.${c.type}`)} · {date(c.period, df)}
                  </span>
                  <span className="font-medium">{money(open, locale)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Mieter: Zahlungsverlauf */}
      {renters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.paymentHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {paymentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noPayments")}</p>
            ) : (
              paymentHistory.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t(`chargeType.${p.type}`)} · {date(p.date, df)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{money(p.amount, locale)}</span>
                    <Badge variant="secondary">{t("portal.chargeStatus.paid")}</Badge>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Eigentümer: Eigentum */}
      {owners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.myUnits")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {owners.map((o) => (
              <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-medium">
                  {o.unit.building.property.name} · {o.unit.label}
                </div>
                <div className="text-muted-foreground">
                  MEA {decimal(o.unit.mea, locale)} · {t("weg.share")}: {decimal(o.share, locale)}‰
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Eigentümer: Beschlüsse */}
      {owners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.resolutions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resolutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noResolutions")}</p>
            ) : (
              resolutions.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>
                    #{r.number} · {r.title}
                    {r.subcommunity && ` (${r.subcommunity.name})`}
                  </span>
                  <Badge variant={r.result === "ANGENOMMEN" ? "secondary" : "outline"}>
                    {t(`resolutionResult.${r.result}`)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Dokumente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("portal.myDocuments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portal.noDocuments")}</p>
          ) : (
            documents.map((d) => (
              <a
                key={d.id}
                href={`/api/documents/${d.id}`}
                className="flex justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span>{d.name}</span>
                <span className="text-muted-foreground">{t(`documentCategory.${d.category}`)}</span>
              </a>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
