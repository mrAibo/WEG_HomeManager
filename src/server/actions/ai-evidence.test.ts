import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRole } from "@/lib/rbac";
import { addCaseEvidence } from "@/server/ai-evidence-workflow";
import { uploadCaseEvidenceAction } from "./ai-evidence";

vi.mock("@/lib/rbac", () => ({ requireRole: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/ai-evidence-workflow", () => ({
  addCaseEvidence: vi.fn(),
}));
const user = { id: "synthetic-manager", tenantId: "synthetic-tenant", role: "ADMIN" as const,
  superAdmin: false, homeTenantId: "synthetic-tenant" };
const form = (content: Uint8Array, name: string) => {
  const data = new FormData();
  data.set("caseId", "synthetic-case");
  const safeBytes = new Uint8Array(new ArrayBuffer(content.byteLength));
  safeBytes.set(content);
  data.set("file", new File([safeBytes], name, { type: "application/pdf" }));
  return data;
};
describe("E3 evidence upload server authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(user);
    vi.mocked(addCaseEvidence).mockResolvedValue({
      id: "e-1", name: "f.pdf", mime: "application/pdf", sha256: "a".repeat(64), size: 11,
    });
  });

  it("uses Auth.js actor, ignores injected client role/tenant", async () => {
    const data = form(new Uint8Array([37, 80, 68, 70, 45, 49]), "f.pdf");
    data.set("actorId", "impersonator");
    data.set("tenantId", "other");
    const result = await uploadCaseEvidenceAction(data);
    expect(result).toEqual({ ok: true, evidenceId: "e-1" });
    expect(addCaseEvidence).toHaveBeenCalledWith(
      { id: user.id, tenantId: user.tenantId, role: "ADMIN" },
      "synthetic-case", "f.pdf", expect.any(Buffer),
    );
  });
  it("rejects unprivileged role even if guard unexpectedly returns it", async () => {
    vi.mocked(requireRole).mockResolvedValue({ ...user, role: "BEIRAT" });
    expect((await uploadCaseEvidenceAction(form(new Uint8Array([1]), "x.pdf"))).ok).toBe(false);
    expect(addCaseEvidence).not.toHaveBeenCalled();
  });
  it("rejects empty file", async () => {
    expect((await uploadCaseEvidenceAction(form(new Uint8Array([]), "x.pdf"))).ok).toBe(false);
    expect(addCaseEvidence).not.toHaveBeenCalled();
  });
  it("checks max size before loading file bytes", async () => {
    const large = new Uint8Array(10 * 1024 * 1024 + 1);
    expect((await uploadCaseEvidenceAction(form(large, "x.pdf"))).ok).toBe(false);
    expect(addCaseEvidence).not.toHaveBeenCalled();
  });
  it("rejects malformed Case id", async () => {
    const data = form(new Uint8Array([1]), "x.pdf");
    data.set("caseId", "x".repeat(130));
    expect((await uploadCaseEvidenceAction(data)).ok).toBe(false);
    expect(addCaseEvidence).not.toHaveBeenCalled();
  });
  it("does not leak database errors", async () => {
    vi.mocked(addCaseEvidence).mockRejectedValue(new Error("sensitive DB connection"));
    const result = await uploadCaseEvidenceAction(form(new Uint8Array([1]), "x.pdf"));
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("sensitive");
  });
  it("does not run work if authentication fails", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("unauthorized"));
    await expect(uploadCaseEvidenceAction(form(new Uint8Array([1]), "x.pdf")))
      .rejects.toThrow("unauthorized");
    expect(addCaseEvidence).not.toHaveBeenCalled();
  });
});
