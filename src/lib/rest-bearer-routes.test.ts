import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateBearer } from "@/lib/api-auth";
import { apiCreate, apiUpdate, apiDelete } from "@/lib/api-write";
import { runOperation } from "@/lib/api-ops";
import { createTicket, createTask, createPerson, listTickets } from "@/lib/api-data";
import { POST as ticketPost, GET as ticketGet } from "@/app/api/v1/tickets/route";
import { POST as taskPost } from "@/app/api/v1/tasks/route";
import { POST as personPost } from "@/app/api/v1/persons/route";
import { POST as opPost } from "@/app/api/v1/operations/[op]/route";
import { POST as recordPost } from "@/app/api/v1/records/[entity]/route";
import {
  PATCH as recordPatch, DELETE as recordDelete,
} from "@/app/api/v1/records/[entity]/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  authenticateBearer: vi.fn(),
  unauthorized: vi.fn(() => Response.json({ error: "Unauthorized" }, { status: 401 })),
}));
vi.mock("@/lib/api-data", () => ({
  createTicket: vi.fn(), createTask: vi.fn(), createPerson: vi.fn(), listTickets: vi.fn(),
}));
vi.mock("@/lib/api-write", () => ({
  apiCreate: vi.fn(), apiUpdate: vi.fn(), apiDelete: vi.fn(),
  ApiWriteError: class ApiWriteError extends Error {},
}));
vi.mock("@/lib/api-ops", () => ({ runOperation: vi.fn() }));
const admin = { userId: "human-admin", tenantId: "tenant-a", role: "ADMIN", name: "Demo" };

describe("All existing REST route writes fail before token auth and domain writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateBearer).mockResolvedValue(admin as never);
    vi.mocked(listTickets).mockResolvedValue([] as never);
  });
  const cases: Array<[string, (req: Request) => Promise<Response>, () => unknown]> = [
    ["/api/v1/tickets", ticketPost, () => createTicket],
    ["/api/v1/tasks", taskPost, () => createTask],
    ["/api/v1/persons", personPost, () => createPerson],
    ["/api/v1/records/ticket", req => recordPost(req, { params: Promise.resolve({ entity: "ticket" }) }), () => apiCreate],
    ["/api/v1/records/ticket/one", req => recordPatch(req, { params: Promise.resolve({ entity: "ticket", id: "one" }) }), () => apiUpdate],
    ["/api/v1/records/ticket/one", req => recordDelete(req, { params: Promise.resolve({ entity: "ticket", id: "one" }) }), () => apiDelete],
    ["/api/v1/operations/send_email", req => opPost(req, { params: Promise.resolve({ op: "send_email" }) }), () => runOperation],
  ];
  const methods = ["POST", "POST", "POST", "POST", "PATCH", "DELETE", "POST"];
  cases.forEach(([path, handler, spy], i) => {
    it(methods[i] + " " + path + " returns 403 without token lookup or a write", async () => {
      const request = new Request("http://localhost" + path, {
        method: methods[i],
        headers: { authorization: "Bearer very-broad-legacy-token", "content-type": "application/json" },
        body: methods[i] === "DELETE" ? undefined : JSON.stringify({ title: "MUTATE" }),
      });
      const response = await handler(request);
      expect(response.status).toBe(403);
      expect(authenticateBearer).not.toHaveBeenCalled();
      expect(spy()).not.toHaveBeenCalled();
    });
  });
  it("retains authorized GET behavior for legacy read clients", async () => {
    const response = await ticketGet(new Request("http://localhost/api/v1/tickets", {
      headers: { authorization: "Bearer legitimate-read-token" },
    }));
    expect(response.status).toBe(200);
    expect(authenticateBearer).toHaveBeenCalledOnce();
    expect(listTickets).toHaveBeenCalledWith("tenant-a");
  });
});
