// MCP is an untrusted model-facing surface. Explicit allowlist: fail closed when
// upstream adds tools. Human approval is NOT inferred from a Bearer token.
// Do not enable writes until scoped approvals, audit and idempotency are implemented.
export const READ_ONLY_MCP_TOOLS = new Set([
  "portfolio_summary",
  "list_properties",
  "get_property",
  "list_units",
  "list_persons",
  "list_leases",
  "list_tickets",
  "list_open_items",
  "list_owners",
  "list_meters",
  "list_accounts",
  "list_charges",
  "list_payments",
  "list_documents",
  "list_meetings",
  "list_resolutions",
  "list_economic_plans",
  "list_reserves",
  "list_appointments",
  "list_tasks",
  "list_contractors",
  "list_maintenance_contracts",
  "list_insurances",
  "list_property_taxes",
]);

export function isMcpReadOnlyTool(name: string): boolean {
  return READ_ONLY_MCP_TOOLS.has(name);
}
