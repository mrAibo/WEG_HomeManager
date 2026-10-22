# Architecture — AI-first case orchestration

**Stage:** architectural proposal, not implemented in production.

## Reuse HaVeWa rather than duplicate modules
Existing upstream features verified by reading source/README (October 2026):
- `src/lib/ai.ts`: Anthropic/OpenAI-compatible text assistant, configured per tenant.
- `src/components/ai-assistant.tsx`: question-and-answer UI.
- `src/app/api/mcp/route.ts`: MCP tools, including read and write operations.
- Ticket, document, finance and meeting APIs.

Gap: an end-to-end, stateful, evidence-backed intake → proposal → edit → approval → tracked execution pipeline. That is WEG HomeManager's differentiating layer.

## Logical components
```
Mobile photo / Scan / Email / Voice / Chat
                 |
            Intake Gateway
     file safety, MIME, size, AV,
        metadata/PII controls
                 |
           Evidence Store
  immutable original + OCR/transcript
  page/region references + versioning
                 |
       Case / Task Orchestrator
    state machine + scoped context
                 |
   +-------------+---------------+
   |             |               |
Extraction   Planning/Tools    Rules & Risk
   |             |               |
   +------ Proposed actions ------+
                  |
         Human Review Workspace
  edit / request changes / approve
                  |
        Policy-Enforced Executor
  email, tickets, contractors, orders,
  invoices (never model-direct writes)
                  |
          Outcome & Audit Log
   reminders, evidence, reconciliation
```

## Agent responsibilities
Prefer **one orchestrator + task-specific capabilities**, not uncontrolled agent-to-agent chat loops:
- Intake and OCR/vision classifier (data extraction, explicit uncertainties)
- Maintenance and contractor research (search sources, geographic fit, qualifications, evidence)
- Finance assistant (prepare classification; deterministic ledger owns exact values)
- Documents/communications (editable German drafts)
- Meeting/legal assistant (retrieve rules; flag uncertainty and specialist review)
- Follow-up assistant (track approved requests, reminders and responses)

Providers: pluggable adapter, including local/private deployments. All tools have policy-checked per-user, per-tenant scopes.

## Canonical data contracts
### Case
`caseId, tenantId, propertyId?, unitId?, createdBy, origin, evidenceRefs[], summary, urgency, status, taskIds[], auditEvents[]`

### Evidence
`evidenceId, tenantId, sourceType(photo|pdf|email|voice|text), blobRef, contentHash, extractedFields[], provenance(page/bbox/time), sensitivity, createdAt`

### Proposal
`proposalId, caseId, type, version, editablePayload, sourceRefs[], risk, modelMetadata?, status(draft|review|approved|rejected), approver?, approvalVersion?, auditEvents[]`

### External execution
`actionId, idempotencyKey, approvedProposalId, approvedVersion, executorIdentity, destination, attempt, providerReceipt, committedAt`.
Store a durable, atomic execution record to avoid duplicate emails/orders/payments across retries.

## Orchestration behavior
1. Ingest source; run malware/file/permission checks.
2. Recognize document or complaint; if safety-critical, present immediate escalation.
3. Extract fields with citations and mark unknowns.
4. Retrieve approved property-specific context with strict authorization.
5. Propose ordered tasks, dependencies and drafts; user can edit each field and regenerate individual portions.
6. Human approves *a specific revision* and role-specific action; any edit invalidates approval.
7. Executor checks policy, consent, evidence and idempotency; then performs the authorized action.
8. Persist receipts, track replies and update case status.

## Contractor research — no fake availability
Source candidates from live verified directories/known supplier lists when integrations are available. Store addresses, service area, trade, credentials if verifiable, source URL and timestamp. Prices and availability must come from explicit quotes or provider responses, not model inference.
The AI can rank candidates on user-chosen criteria with explanation; it cannot silently hire them.

## Not an autonomous accountant or lawyer
- Math, tax and vote calculation: deterministic versioned modules with tests and human sign-off.
- AI summarizes and proposes; it is not the legal decision maker.
- A language-model answer is never a source document.
- Avoid uploading an owner's data to an external provider without a suitable privacy basis and contracts.

## First implementation
Add a separate `src/features/ai-case/` module **after HaVeWa code is imported**, with a persistence-backed state machine, authorization boundary and agent adapter.
A dependency-free experimental version lives under `prototype/ai-case/`; it intentionally does not touch real accounts or the HaVeWa database.
