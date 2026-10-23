"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/rbac";

const createSchema = z.object({
  meetingId: z.string().min(1).max(128),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(2500),
});
const reviewSchema = z.object({
  suggestionId: z.string().min(1).max(128),
  decision: z.enum(["ADD", "NOT_ON_AGENDA"]),
});

export async function submitMeetingSuggestion(form: FormData): Promise<void> {
  const user = await requireUser();
  if (!["EIGENTUEMER", "MIETER"].includes(user.role)) throw Error("Keine Berechtigung.");
  const input = createSchema.parse({
    meetingId: form.get("meetingId"),
    title: form.get("title"),
    description: form.get("description"),
  });
  const meeting = await prisma.meeting.findFirst({
    where: { id: input.meetingId, tenantId: user.tenantId, status: "GEPLANT" },
    select: { propertyId: true },
  });
  if (!meeting) throw Error("Versammlung ist nicht offen für Anregungen.");
  const actor = await prisma.user.findFirst({
    where: { id: user.id, tenantId: user.tenantId },
    select: { personId: true },
  });
  if (!actor?.personId) throw Error("Das Benutzerkonto ist keiner berechtigten Person zugeordnet.");
  const personId = actor.personId;
  // Unit relationship is checked SERVER SIDE. Different tenant/property can't submit.
  const linked = user.role === "EIGENTUEMER"
    ? await prisma.owner.count({ where: { tenantId: user.tenantId, personId,
      unit: { building: { propertyId: meeting.propertyId } } } })
    : await prisma.renter.count({ where: { tenantId: user.tenantId, personId,
      lease: { unit: { building: { propertyId: meeting.propertyId } } } } });
  if (!linked) throw Error("Keine Zuordnung zu diesem Objekt.");
  await prisma.meetingSuggestion.create({
    data: {
      tenantId: user.tenantId,
      meetingId: input.meetingId,
      title: input.title,
      description: input.description,
      submittedById: user.id,
      submittedRole: user.role,
    },
  });
  revalidatePath("/portal");
  revalidatePath("/meetings");
  redirect("/portal?anregung=eingereicht");
}

export async function reviewMeetingSuggestion(form: FormData): Promise<void> {
  const user = await requireRole(["VERWALTER"]);
  if (!["ADMIN", "VERWALTER"].includes(user.role)) throw Error("Keine Berechtigung.");
  const input = reviewSchema.parse({
    suggestionId: form.get("suggestionId"),
    decision: form.get("decision"),
  });
  const updatedMeetingId = await prisma.$transaction(async (tx) => {
    const suggestion = await tx.meetingSuggestion.findFirst({
      where: { id: input.suggestionId, tenantId: user.tenantId, status: "NEW" },
      include: { meeting: { select: { id: true, tenantId: true, status: true } } },
    });
    if (!suggestion || suggestion.meeting.tenantId !== user.tenantId ||
      suggestion.meeting.status !== "GEPLANT") {
      throw Error("Anregung nicht vorhanden oder nicht mehr bearbeitbar.");
    }
    const claimed = await tx.meetingSuggestion.updateMany({
      where: { id: suggestion.id, tenantId: user.tenantId, status: "NEW" },
      data: { status: input.decision === "ADD" ? "ADDED" : "NOT_ON_AGENDA",
        reviewedById: user.id, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) throw Error("Anregung bereits geprüft.");
    if (input.decision === "ADD") {
      const highest = await tx.agendaItem.aggregate({
        where: { tenantId: user.tenantId, meetingId: suggestion.meetingId },
        _max: { position: true },
      });
      const agenda = await tx.agendaItem.create({
        data: { tenantId: user.tenantId, meetingId: suggestion.meetingId,
          position: (highest._max.position ?? 0) + 1,
          title: suggestion.title,
          description: `Anregung aus dem Portal (${suggestion.submittedRole}).\n${suggestion.description}` },
      });
      await tx.meetingSuggestion.update({
        where: { id: suggestion.id }, data: { agendaItemId: agenda.id },
      });
    }
    return suggestion.meetingId;
  });
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${updatedMeetingId}`);
  redirect(`/meetings/${updatedMeetingId}`);
}
