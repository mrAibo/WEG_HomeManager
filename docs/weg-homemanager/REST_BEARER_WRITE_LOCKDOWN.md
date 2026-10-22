# E4: REST Bearer API — mandatory read-only security boundary

**Date:** 2026-10-22. **Default:** /api/v1 is READ ONLY without exception. No feature flag or secret environment bypass.

## Problem and immediate mitigation

Original HaVeWa allows personal Bearer tokens for /api/v1 mutations based on ADMIN/VERWALTER/BUCHHALTUNG role, but such tokens do not embody a verified human approval for one action/target/version. An LLM or poorly scoped automation holding a broad token could create or update records, run billing, import banks or send messages directly. This is P0 Issue #11.

**Mitigation in this Draft PR:** block **all mutating HTTP methods** (anything except GET, HEAD and OPTIONS) on any path `/api/v1` or `/api/v1/*`, return `403 REST_BEARER_READ_ONLY` and `Cache-Control: no-store` **before** Bearer authentication, parsing or any database/communication operation. Additionally `authenticateBearer` refuses to yield a principal for any REST write, protecting future accidentally added routes. No route- or env-level bypass.

Specifically inventoried and blocked:
- `POST /api/v1/tickets` — create maintenance ticket;
- `POST /api/v1/tasks` — create reminder/task;
- `POST /api/v1/persons` — create contacts;
- `POST /api/v1/records/[entity]` — general records including people, owners, account, payments, contracts and users;
- `PATCH /api/v1/records/[entity]/[id]` — update any supported record;
- `DELETE /api/v1/records/[entity]/[id]` — delete a supported record;
- `POST /api/v1/operations/[op]` — charge/dunning/bank/email and other privileged operations.

The existing `/api/mcp` endpoint still uses **POST as a JSON-RPC transport**; its tool execution remains enforced through the independent `READ_ONLY_MCP_TOOLS` allowlist. No MCP creation, sending, deletion, payment or bank import. `/api/v1` GET endpoints preserve Bearer read functionality. Normal WebGUI remains on Auth.js session-based Server Actions; it is outside this Bearer write interface and must maintain its own RBAC and human approvals.

## Compatibility impact

This change intentionally **BREAKS external API write integrations** that used personal Bearer tokens. Such requests now receive 403, including legitimate administrators. Existing client integrations should not fall back to browser automation, sharing login credentials or using MCP write operations. If a real business integration needs writes, first design a separate least-privilege service identity with explicit authenticated human-confirmed per-object/per-action scope, immutable version binding, expiry, durable idempotency/receipt, tenant checks and mandatory audit. Obtain security approval and test before enabling.

**No claim that Issue #11 is fully closed:** token **reads** still expose confidential tenant records to the holder, and comprehensive field-level access, token issuance/revocation, per-object authorization and audited approval-based executors need separate review. This is the immediate write-containment increment.

## Tests

- `src/lib/rest-bearer-policy.test.ts`: explicit write route/method deny matrix, 403 no-store, unknown future route denial, GET/HEAD/OPTIONS allowed, MCP and WebGUI unaffected.
- `src/lib/rest-bearer-routes.test.ts`: all seven legacy mutation handlers return 403 even with a broad Bearer header, without evaluating authentication or calling any domain mutation; GET still works for authenticated read client.
- `src/lib/rest-bearer-auth.test.ts`: defense-in-depth rejects new/future REST write requests **before token lookup**, allows GET.
- Production smoke should confirm 403 from actual Next.js REST POST and MCP tool discovery still excludes all write tools, plus existing Chrome Case upload/review flow.

## Required before production

- Audit and rotate/revoke any tokens that may have reached automation or AI.
- Add service-principal and scope granularity, rate limiting and read-access data minimization.
- Finish Issue #11 review of all API and privileged workflows, including live mail/bank.
- Keep test tenant synthetic and the entire PR stack in Draft; do not grant model Bearer credentials.
