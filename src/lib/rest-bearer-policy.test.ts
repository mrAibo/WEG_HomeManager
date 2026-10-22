import { describe, expect, it } from "vitest";
import { denyBearerRestMutation, isBearerRestMutation } from "./rest-bearer-policy";
const req = (path: string, method: string) => new Request("http://localhost" + path, { method });

describe("P0 legacy bearer REST write kill-switch (unconditionally fail-closed)", () => {
  const writePaths = [
    ["/api/v1/tickets", "POST"],
    ["/api/v1/tasks", "POST"],
    ["/api/v1/persons", "POST"],
    ["/api/v1/records/property", "POST"],
    ["/api/v1/records/property/some-id", "PATCH"],
    ["/api/v1/records/property/some-id", "DELETE"],
    ["/api/v1/operations/send_email", "POST"],
    ["/api/v1/operations/import_camt", "POST"],
    ["/api/v1/operations/run_charge_generation", "POST"],
  ] as const;
  for (const [route, method] of writePaths) {
    it("blocks " + method + " " + route + " with 403/no-store", async () => {
      const request = req(route, method);
      expect(isBearerRestMutation(request)).toBe(true);
      const response = denyBearerRestMutation(request);
      expect(response?.status).toBe(403);
      expect(response?.headers.get("cache-control")).toBe("no-store");
      expect((await response?.json()).code).toBe("REST_BEARER_READ_ONLY");
    });
  }
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    it("allows read/preflight " + method + " on v1 API", () => {
      const request = req("/api/v1/tickets", method);
      expect(isBearerRestMutation(request)).toBe(false);
      expect(denyBearerRestMutation(request)).toBeNull();
    });
  }
  it("does not affect MCP JSON-RPC transport POST", () =>
    expect(denyBearerRestMutation(req("/api/mcp", "POST"))).toBeNull());
  it("does not affect session-authenticated WebGUI server actions", () =>
    expect(denyBearerRestMutation(req("/de/dashboard", "POST"))).toBeNull());
  it("blocks unknown future REST POST/PUT automatically", () => {
    expect(isBearerRestMutation(req("/api/v1/new-dangerous-thing", "PUT"))).toBe(true);
  });
});
