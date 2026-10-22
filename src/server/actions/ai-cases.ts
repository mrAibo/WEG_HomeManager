"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  approveLocalCopy, CaseWorkflowError, createLocalCase,
  getApprovedLocalCopy, reviseLocalProposal, submitLocalProposal,
} from "@/server/ai-case-workflow";

// The browser supplies ONLY case text and the IDs/expected versions.
// Actor ID, role, tenant scope and permission ALWAYS come from Auth.js.
const createInput = z.object({
  kind: z.enum(["PHOTO", "DOCUMENT", "QUESTION"]),
  description: z.string().trim().min(10).max(3000),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
});
const proposalInput = z.object({
  proposalId: z.string().min(1).max(128),
  expectedVersion: z.number().int().min(1),
});
const reviseInput = proposalInput.extend({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
});

export type CaseActionResult = {
  ok: boolean;
  error?: string;
  caseId?: string;
  version?: number;
  approved?: { title: string; body: string; version: number };
};

function failure(error: unknown): CaseActionResult {
  if (error instanceof CaseWorkflowError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return {
    ok: false, error: "Bitte Betreff, Text und Versionsangaben überprüfen.",
  };
  // Never return raw database, stack or sensitive errors to a browser.
  return { ok: false, error: "Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen." };
}

async function withHuman(
  work: (actor: { id: string; tenantId: string; role: "ADMIN" | "VERWALTER" }) => Promise<CaseActionResult>,
): Promise<CaseActionResult> {
  // Redirects unauthenticated/disallowed users; never accept an actor from the client.
  const user = await requireRole(["VERWALTER"]);
  if (user.role !== "ADMIN" && user.role !== "VERWALTER") {
    return { ok: false, error: "Keine Berechtigung." };
  }
  try {
    return await work({ id: user.id, tenantId: user.tenantId, role: user.role });
  } catch (error) {
    return failure(error);
  }
}

export async function saveDashboardCaseAction(raw: z.input<typeof createInput>): Promise<CaseActionResult> {
  return withHuman(async (actor) => {
    const parsed = createInput.parse(raw);
    const result = await createLocalCase(actor, {
      kind: parsed.kind,
      summary: parsed.description.replace(/\s+/g, " ").slice(0, 160),
      sourceText: parsed.description,
      title: parsed.title,
      body: parsed.body,
    });
    revalidatePath("/cases");
    revalidatePath("/dashboard");
    return { ok: true, caseId: result.caseId, version: result.version };
  });
}

export async function reviseSavedCaseAction(raw: z.input<typeof reviseInput>): Promise<CaseActionResult> {
  return withHuman(async (actor) => {
    const input = reviseInput.parse(raw);
    const result = await reviseLocalProposal(actor, input.proposalId, input.expectedVersion, {
      title: input.title, body: input.body,
    });
    revalidatePath("/cases");
    return { ok: true, version: result.version };
  });
}

export async function submitSavedCaseAction(raw: z.input<typeof proposalInput>): Promise<CaseActionResult> {
  return withHuman(async (actor) => {
    const input = proposalInput.parse(raw);
    const result = await submitLocalProposal(actor, input.proposalId, input.expectedVersion);
    revalidatePath("/cases");
    return { ok: true, version: result.version };
  });
}

export async function approveSavedCaseCopyAction(raw: z.input<typeof proposalInput>): Promise<CaseActionResult> {
  return withHuman(async (actor) => {
    const input = proposalInput.parse(raw);
    const result = await approveLocalCopy(actor, input.proposalId, input.expectedVersion);
    revalidatePath("/cases");
    return { ok: true, version: result.approvedVersion };
  });
}

export async function fetchApprovedCaseCopyAction(raw: { proposalId: string }): Promise<CaseActionResult> {
  return withHuman(async (actor) => {
    const input = z.object({ proposalId: z.string().min(1).max(128) }).parse(raw);
    const approved = await getApprovedLocalCopy(actor, input.proposalId);
    return { ok: true, version: approved.version, approved: {
      title: approved.title, body: approved.body, version: approved.version,
    } };
  });
}
