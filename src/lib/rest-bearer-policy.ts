/** REST Bearer credentials are never human execution approvals.
 * Legacy /api/v1 mutations are unavailable until a persisted, scoped, audited
 * human-execution protocol is implemented. NO environment bypass.
 * This does NOT block WebGUI Auth.js server actions or read-only MCP JSON-RPC.
 */
export function isBearerRestMutation(req: Request): boolean {
  const method = req.method.toUpperCase();
  const path = new URL(req.url).pathname;
  return (path === "/api/v1" || path.startsWith("/api/v1/")) &&
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export function denyBearerRestMutation(req: Request): Response | null {
  if (!isBearerRestMutation(req)) return null;
  return Response.json(
    {
      error: "Forbidden — Bearer REST API ist schreibgeschützt. Änderungen nur über autorisierte WebGUI-Aktionen.",
      code: "REST_BEARER_READ_ONLY",
    },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
