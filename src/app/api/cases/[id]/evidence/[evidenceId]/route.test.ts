import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";
import { evidenceHash } from "@/lib/ai-evidence-policy";
import { GET } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/acting-tenant", () => ({ actingTenantId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { aiEvidence: { findFirst: vi.fn() } } }));
vi.mock("@/lib/storage", () => ({ readFile: vi.fn() }));
const bytes = Buffer.from("%PDF-1.4\n%%EOF\n");
const request = new Request("http://localhost/api/cases/c1/evidence/e1");
const params = { params: Promise.resolve({ id: "c1", evidenceId: "e1" }) };

describe("authenticated evidence downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: "synthetic-admin", role: "ADMIN", tenantId: "synthetic-tenant" },
    } as never);
    vi.mocked(actingTenantId).mockResolvedValue("synthetic-tenant");
    vi.mocked(prisma.aiEvidence.findFirst).mockResolvedValue({
      storageKey: "random.pdf", name: "sample.pdf", mime: "application/pdf",
      sha256: evidenceHash(bytes), size: bytes.length,
    } as never);
    vi.mocked(readFile).mockResolvedValue(bytes);
  });

  it("requires login", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await GET(request, params)).status).toBe(401);
    expect(readFile).not.toHaveBeenCalled();
  });
  it("denies portal role before any DB read", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: "EIGENTUEMER" } } as never);
    expect((await GET(request, params)).status).toBe(403);
    expect(prisma.aiEvidence.findFirst).not.toHaveBeenCalled();
  });
  it("filters simultaneously on case, evidence and tenant", async () => {
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(prisma.aiEvidence.findFirst).toHaveBeenCalledWith({
      where: { id: "e1", caseId: "c1", tenantId: "synthetic-tenant" },
      select: { storageKey: true, name: true, mime: true, sha256: true, size: true },
    });
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("does not read file for absent/foreign evidence", async () => {
    vi.mocked(prisma.aiEvidence.findFirst).mockResolvedValue(null);
    expect((await GET(request, params)).status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });
  it("rejects tampered file content", async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from("different"));
    expect((await GET(request, params)).status).toBe(409);
  });
});
