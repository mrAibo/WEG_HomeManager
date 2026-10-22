import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateBearer } from "./api-auth";
import { prisma } from "./prisma";

vi.mock("./prisma", () => ({
  prisma: { apiToken: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("./rbac", () => ({ roleAllows: vi.fn(() => true), WRITE_ROLES: ["VERWALTER", "BUCHHALTUNG"] }));

describe("Bearer authentication is read-only even if a future handler forgets its route guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: "token-1", revokedAt: null,
      user: { id: "user-1", tenantId: "tenant-1", role: "ADMIN", name: "Synthetic" },
    } as never);
    vi.mocked(prisma.apiToken.update).mockResolvedValue({} as never);
  });
  for (const method of ["POST", "PATCH", "DELETE", "PUT"]) {
    it("never looks up token for future REST " + method + " writes", async () => {
      const req = new Request("http://localhost/api/v1/new-mutation", {
        method, headers: { authorization: "Bearer hvw_any-old-token" },
      });
      expect(await authenticateBearer(req)).toBeNull();
      expect(prisma.apiToken.findUnique).not.toHaveBeenCalled();
      expect(prisma.apiToken.update).not.toHaveBeenCalled();
    });
  }
  it("still authenticates GET for backward-compatible read APIs", async () => {
    const req = new Request("http://localhost/api/v1/tickets", {
      headers: { authorization: "Bearer hvw_any-old-token" },
    });
    expect(await authenticateBearer(req)).toMatchObject({
      userId: "user-1", tenantId: "tenant-1", role: "ADMIN",
    });
    expect(prisma.apiToken.findUnique).toHaveBeenCalledOnce();
  });
});
