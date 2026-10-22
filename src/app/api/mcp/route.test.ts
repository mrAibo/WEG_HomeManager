import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateBearer } from "@/lib/api-auth";
import { apiCreate, apiUpdate, apiDelete } from "@/lib/api-write";
import { runOperation } from "@/lib/api-ops";
import { POST } from "./route";

vi.mock("@/lib/api-auth", () => ({
  authenticateBearer: vi.fn(),
}));
vi.mock("@/lib/api-data", () => ({
  portfolioSummary: vi.fn().mockResolvedValue({ properties: 0 }),
}));
vi.mock("@/lib/api-write", () => ({
  apiCreate: vi.fn(),
  apiUpdate: vi.fn(),
  apiDelete: vi.fn(),
  listEntities: vi.fn(),
  ENTITIES: ["ticket"],
}));
vi.mock("@/lib/api-ops", () => ({
  runOperation: vi.fn(),
  listOperations: vi.fn(),
  OPERATION_NAMES: ["send_email"],
}));

const principal = { userId: "synthetic-user", tenantId: "synthetic-tenant", role: "ADMIN", name: "Test" };
const post = async (method: string, params?: unknown) => {
  const res = await POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { authorization: "Bearer synthetic-token", "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  return { status: res.status, body: await res.json() };
};

describe("MCP fail-closed write boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateBearer).mockResolvedValue(principal as never);
  });

  it("only advertises explicitly allowed read-only tools", async () => {
    const { body } = await post("tools/list");
    const names: string[] = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain("list_tickets");
    expect(names).toContain("portfolio_summary");
    expect(names).not.toContain("create_ticket");
    expect(names).not.toContain("create_record");
    expect(names).not.toContain("run_operation");
    expect(names).not.toContain("list_entities");
    expect(names).not.toContain("list_operations");
    expect(new Set(names).size).toBe(names.length);
  });

  it.each([
    "create_task", "create_ticket", "create_person", "create_record",
    "update_record", "delete_record", "run_operation", "list_entities",
    "list_operations", "unknown_new_upstream_tool",
  ])("rejects the tool '%s' on direct invocation", async (name) => {
    const { body } = await post("tools/call", { name, arguments: {} });
    expect(body.error.code).toBe(-32602);
    expect(apiCreate).not.toHaveBeenCalled();
    expect(apiUpdate).not.toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
    expect(runOperation).not.toHaveBeenCalled();
  });

  it("keeps read-only tools functional", async () => {
    const { body } = await post("tools/call", { name: "portfolio_summary", arguments: {} });
    expect(body.result.content[0].text).toContain("properties");
  });

  it("requires authentication for discovery and calls", async () => {
    vi.mocked(authenticateBearer).mockResolvedValue(null);
    expect((await post("tools/list")).status).toBe(401);
    expect((await post("tools/call", { name: "portfolio_summary" })).status).toBe(401);
  });
});
