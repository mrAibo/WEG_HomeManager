import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  approveLocalCopy, createLocalCase, getApprovedLocalCopy,
  reviseLocalProposal, submitLocalProposal,
} from "@/server/ai-case-workflow";
import {
  approveSavedCaseCopyAction, fetchApprovedCaseCopyAction,
  reviseSavedCaseAction, saveDashboardCaseAction, submitSavedCaseAction,
} from "./ai-cases";

vi.mock("@/lib/rbac", () => ({ requireRole: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/ai-case-workflow", () => ({
  CaseWorkflowError: class CaseWorkflowError extends Error {},
  approveLocalCopy: vi.fn(),
  createLocalCase: vi.fn(),
  getApprovedLocalCopy: vi.fn(),
  reviseLocalProposal: vi.fn(),
  submitLocalProposal: vi.fn(),
}));

const admin = {
  id: "trusted-server-user", tenantId: "synthetic-server-tenant",
  homeTenantId: "synthetic-server-tenant", role: "ADMIN" as const,
  superAdmin: false,
};

const intake = {
  kind: "QUESTION" as const,
  description: "Im synthetischen Treppenhaus tropft Wasser aus der Decke.",
  title: "Prüfauftrag vorbereiten",
  body: "Bitte prüfen Sie die Ursache.",
};

describe("E3 Auth.js-backed Case server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(admin);
    vi.mocked(createLocalCase).mockResolvedValue({
      caseId: "case-1", proposalId: "proposal-1", version: 1,
    });
    vi.mocked(reviseLocalProposal).mockResolvedValue({ version: 2, state: "DRAFT" });
    vi.mocked(submitLocalProposal).mockResolvedValue({ version: 1, state: "IN_REVIEW" });
    vi.mocked(approveLocalCopy).mockResolvedValue({ approvedVersion: 1, scope: "COPY_ONLY" });
    vi.mocked(getApprovedLocalCopy).mockResolvedValue({
      title: "Freigabe", body: "Text", version: 1, scope: "COPY_ONLY",
    });
  });

  it("uses verified identity, ignores injected actor/tenant/foreign property", async () => {
    const result = await saveDashboardCaseAction({
      ...intake, actor: { id: "fake-admin", tenantId: "other" },
      tenantId: "other-tenant", propertyId: "cross-tenant-id",
    } as typeof intake);
    expect(result).toEqual({ ok: true, caseId: "case-1", version: 1 });
    expect(requireRole).toHaveBeenCalledWith(["VERWALTER"]);
    expect(createLocalCase).toHaveBeenCalledWith(
      { id: admin.id, tenantId: admin.tenantId, role: "ADMIN" },
      { kind: "QUESTION", summary: intake.description, sourceText: intake.description,
        title: intake.title, body: intake.body },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/cases");
  });

  it("fails closed for non-manager roles even if a guard were to return one", async () => {
    vi.mocked(requireRole).mockResolvedValue({ ...admin, role: "BUCHHALTUNG" });
    expect(await saveDashboardCaseAction(intake)).toEqual({
      ok: false, error: "Keine Berechtigung.",
    });
    expect(createLocalCase).not.toHaveBeenCalled();
  });

  it("forwards exact proposal version and trusted actor for revision", async () => {
    const input = { proposalId: "proposal-1", expectedVersion: 4,
      title: "Geprüft", body: "Bearbeiteter Text" };
    expect((await reviseSavedCaseAction(input)).ok).toBe(true);
    expect(reviseLocalProposal).toHaveBeenCalledWith(
      { id: admin.id, tenantId: admin.tenantId, role: "ADMIN" },
      input.proposalId, 4, { title: input.title, body: input.body },
    );
  });

  it("rejects malformed version before any database call", async () => {
    const result = await submitSavedCaseAction({
      proposalId: "proposal-1", expectedVersion: -1,
    });
    expect(result.ok).toBe(false);
    expect(submitLocalProposal).not.toHaveBeenCalled();
  });

  it("does not expose raw unexpected errors", async () => {
    vi.mocked(approveLocalCopy).mockRejectedValue(new Error("database secret"));
    const result = await approveSavedCaseCopyAction({
      proposalId: "proposal-1", expectedVersion: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("database secret");
  });

  it("requires authenticated manager to fetch approved text", async () => {
    const result = await fetchApprovedCaseCopyAction({ proposalId: "proposal-1" });
    expect(result).toEqual({
      ok: true, version: 1,
      approved: { title: "Freigabe", body: "Text", version: 1 },
    });
    expect(getApprovedLocalCopy).toHaveBeenCalledWith(
      { id: admin.id, tenantId: admin.tenantId, role: "ADMIN" }, "proposal-1",
    );
  });

  it("does not execute work when authentication fails", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("redirect to login"));
    await expect(saveDashboardCaseAction(intake)).rejects.toThrow("redirect to login");
    expect(createLocalCase).not.toHaveBeenCalled();
  });
});
