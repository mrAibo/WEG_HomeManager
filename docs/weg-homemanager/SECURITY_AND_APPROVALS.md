# Human-in-the-loop security and approval policy

## Core boundary
An LLM can draft, classify, compare and recommend. Only deterministic services and authorized humans may commit changes. A generated "approved" text is **not** proof of human approval.

## Approval matrix (proposed default)
| Action | AI allowed | Human approval |
|---|---|---|
| Summarize an accessible PDF/photo | Yes, with uncertainty/citations | Optional review |
| Classify maintenance request | Yes, tentative | Review for significant decisions |
| Search public contractors | Yes, if research source connected | No for read-only lookup |
| Compose quote request/email | Yes, editable draft | Required before external send |
| Create internal ticket | Draft by default | Required for committed write unless delegated |
| Select contractor / create order | Recommendation only | Authorized manager + applicable WEG resolution |
| Prepare invoice booking | Draft only | Authorized finance reviewer |
| Initiate bank transfer | Never directly from model | Strong human bank authorization via controlled integration |
| Draft WEG resolution / notice | Yes | Legal/manager review; WEG decisions require appropriate process |
| Change permissions/tenant settings | Never | Admin-controlled workflow; no LLM tool path |

Real legal responsibilities must be modeled separately from a user's UI role.

## Threat model (minimum)
- Prompt injection in OCR, PDF, contractor websites or emails: treat as untrusted evidence, never as system instructions.
- Cross-tenant or cross-unit leakage through RAG, MCP, document blobs or caches.
- Excessive API tokens/permissions, MCP write operations called by agents without approval.
- Replayed approvals, edited drafts after approval, race conditions, duplicate sends on retries.
- Forged invoice bank details and supplier impersonation.
- PII exposure to external LLMs; file retention and deletion requests.
- Incorrect emergency classification; safety-critical requests are not blocked by normal queues.
- Insecure file upload types, malware, exfiltration, PDF parser defects.

## Implementation controls
- Server-side per-object authorization on every read, write, export and AI tool call.
- AI tokens read-only initially; no generic arbitrary `api-write` exposure.
- Immutable original evidence + cryptographic content hashes; editable extracts kept separately.
- Explicit approval record includes actor, role, tenant, proposal version, scope and time.
- On edit: invalidate previous approvals.
- Executions use durable transaction and idempotency keys; no unrecorded side effects.
- Finance uses exact decimal/integer cents; independent reconciliation.
- OCR data fields carry confidence, evidence coordinates and source links.
- Encrypted secrets; strong authentication, backups and tested restore.
- Dev/test fixtures use only synthetic names, addresses, invoices and bank identifiers.
- Controlled outgoing integrations log destination, data disclosed and user authorization.

## Security release gate
No production tenant onboarding until an independent review has tested: authorization, injection, financial correctness, data retention and disaster recovery.
