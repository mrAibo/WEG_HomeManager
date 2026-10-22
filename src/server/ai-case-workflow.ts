// E3 server-side persistence core. Intentionally NOT exported as MCP/API tools.
// The only approval scope here is COPY_ONLY. No ticket, send, order or payment executor.
import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canApproveCopy,
  hashProposalContent,
  hashSourceText,
  isCurrentCopyApproval,
} from "@/lib/ai-case-policy";

export type CaseActor = { id: string; tenantId: string; role: UserRole };

const caseInput = z.object({
  kind: z.enum(["PHOTO", "DOCUMENT", "QUESTION"]),
  propertyId: z.string().min(1).optional(),
  summary: z.string().trim().min(10).max(160),
  sourceText: z.string().trim().min(10).max(3000),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
});

const draftInput = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
});

export class CaseWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseWorkflowError";
  }
}

function managerOnly(actor: CaseActor) {
  if (!actor.id || !actor.tenantId || !canApproveCopy(actor.role)) {
    throw new CaseWorkflowError("Keine Berechtigung zur Bearbeitung von KI-Vorgängen.");
  }
}

async function scopedProposal(tx: Prisma.TransactionClient, actor: CaseActor, id: string) {
  const proposal = await tx.aiProposal.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: { id: true, tenantId: true, caseId: true, version: true, title: true, body: true, contentSha256: true, state: true },
  });
  if (!proposal) throw new CaseWorkflowError("Vorschlag nicht gefunden.");
  return proposal;
}

// Creates a separate intake Case; an operational HaVeWa Ticket is not created.
export async function createLocalCase(
  actor: CaseActor,
  raw: z.input<typeof caseInput>,
) {
  managerOnly(actor);
  const input = caseInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    if (input.propertyId) {
      const property = await tx.property.findFirst({
        where: { id: input.propertyId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!property) throw new CaseWorkflowError("Objekt nicht gefunden oder nicht berechtigt.");
    }
    const created = await tx.aiCase.create({
      data: {
        tenantId: actor.tenantId,
        propertyId: input.propertyId ?? null,
        createdById: actor.id,
        kind: input.kind,
        summary: input.summary,
        sourceText: input.sourceText,
        sourceSha256: hashSourceText(input.sourceText),
      },
    });
    const proposal = await tx.aiProposal.create({
      data: {
        tenantId: actor.tenantId,
        caseId: created.id,
        origin: "TEMPLATE",
        title: input.title,
        body: input.body,
        contentSha256: hashProposalContent(input.title, input.body),
      },
    });
    await tx.aiCaseEvent.create({
      data: {
        tenantId: actor.tenantId, caseId: created.id, actorId: actor.id,
        action: "case_and_template_created", version: 1,
      },
    });
    return { caseId: created.id, proposalId: proposal.id, version: proposal.version };
  });
}

// Optimistic concurrency: a stale edit cannot overwrite a newer version.
// Old approval rows remain as history, but can NEVER authorize a new version.
export async function reviseLocalProposal(
  actor: CaseActor, proposalId: string, expectedVersion: number, raw: z.input<typeof draftInput>,
) {
  managerOnly(actor);
  const input = draftInput.parse(raw);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new CaseWorkflowError("Ungültige Version.");
  return prisma.$transaction(async (tx) => {
    const before = await scopedProposal(tx, actor, proposalId);
    if (before.state === "REJECTED") throw new CaseWorkflowError("Abgelehnter Vorschlag ist gesperrt.");
    const result = await tx.aiProposal.updateMany({
      where: { id: proposalId, tenantId: actor.tenantId, version: expectedVersion, state: { not: "REJECTED" } },
      data: {
        title: input.title, body: input.body,
        contentSha256: hashProposalContent(input.title, input.body),
        version: { increment: 1 }, state: "DRAFT",
      },
    });
    if (result.count !== 1) throw new CaseWorkflowError("Version veraltet. Bitte neu laden.");
    await tx.aiCaseEvent.create({
      data: {
        tenantId: actor.tenantId, caseId: before.caseId, actorId: actor.id,
        action: "proposal_revised", version: expectedVersion + 1,
      },
    });
    return { version: expectedVersion + 1, state: "DRAFT" as const };
  });
}

export async function submitLocalProposal(actor: CaseActor, proposalId: string, expectedVersion: number) {
  managerOnly(actor);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new CaseWorkflowError("Ungültige Version.");
  return prisma.$transaction(async (tx) => {
    const before = await scopedProposal(tx, actor, proposalId);
    const result = await tx.aiProposal.updateMany({
      where: { id: proposalId, tenantId: actor.tenantId, version: expectedVersion, state: "DRAFT" },
      data: { state: "IN_REVIEW" },
    });
    if (result.count !== 1) throw new CaseWorkflowError("Der Entwurf wurde verändert oder bereits eingereicht.");
    await tx.aiCaseEvent.create({
      data: { tenantId: actor.tenantId, caseId: before.caseId, actorId: actor.id,
        action: "proposal_submitted", version: expectedVersion },
    });
    return { state: "IN_REVIEW" as const, version: expectedVersion };
  });
}

export async function approveLocalCopy(actor: CaseActor, proposalId: string, expectedVersion: number) {
  managerOnly(actor);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new CaseWorkflowError("Ungültige Version.");
  return prisma.$transaction(async (tx) => {
    const before = await scopedProposal(tx, actor, proposalId);
    if (before.version !== expectedVersion || before.state !== "IN_REVIEW") {
      throw new CaseWorkflowError("Nur die aktuelle eingereichte Version kann freigegeben werden.");
    }
    // Fail closed if a database field was changed without updating its digest.
    if (before.contentSha256 !== hashProposalContent(before.title, before.body)) {
      throw new CaseWorkflowError("Inhaltssignatur ungültig.");
    }
    const result = await tx.aiProposal.updateMany({
      where: {
        id: before.id, tenantId: actor.tenantId,
        version: expectedVersion, state: "IN_REVIEW", contentSha256: before.contentSha256,
      },
      data: { state: "APPROVED" },
    });
    if (result.count !== 1) throw new CaseWorkflowError("Freigabe überholt.");
    await tx.aiApproval.create({
      data: {
        tenantId: actor.tenantId, proposalId, version: expectedVersion,
        contentSha256: before.contentSha256,
        approvedById: actor.id, approvedRole: actor.role, scope: "COPY_ONLY",
      },
    });
    await tx.aiCaseEvent.create({
      data: {
        tenantId: actor.tenantId, caseId: before.caseId, actorId: actor.id,
        action: "copy_only_approved", version: expectedVersion,
      },
    });
    return { approvedVersion: expectedVersion, scope: "COPY_ONLY" as const };
  });
}

export async function getApprovedLocalCopy(actor: CaseActor, proposalId: string) {
  managerOnly(actor);
  const proposal = await prisma.aiProposal.findFirst({
    where: { id: proposalId, tenantId: actor.tenantId },
    include: { approvals: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!proposal || !isCurrentCopyApproval(proposal, proposal.approvals[0] ?? null)) {
    throw new CaseWorkflowError("Kein gültig freigegebener Text vorhanden.");
  }
  return { title: proposal.title, body: proposal.body, version: proposal.version, scope: "COPY_ONLY" as const };
}
