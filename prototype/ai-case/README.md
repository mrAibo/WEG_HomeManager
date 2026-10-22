# AI Case prototype

An **isolated executable demonstration** of the planned human-in-the-loop workflow. It models an evidence-backed case, a draft produced by an AI actor, manual revision, review, authorized approval and a read-only handoff packet.

**Not production code:** no OCR, no image understanding, no AI provider, no persistence, no browser/network use, no actual tradesperson search, no email delivery, no financial calculation, no payment. Role and tenant checks here demonstrate invariants; production must enforce authenticated, database-backed permissions and atomic execution semantics.

## Requirements
Node.js 20+ only. No npm install required.

## Run
```bash
node --test prototype/ai-case/engine.test.mjs
node prototype/ai-case/demo.mjs
```

## Manual-edit invariant
An approval covers exactly one draft version. Any modification to the draft clears the approval and returns the proposal to `draft`.

## Follow-on integration
After importing HaVeWa, replace this in-memory model with typed, transactionally persisted records; connect to existing tickets/documents, policy-filtered MCP and approval UI. A separate executor must require idempotency keys, authorized users and audit receipts.
