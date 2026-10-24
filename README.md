# WEG HomeManager

**AI-first WEG management, with humans in control.**

> Status: HaVeWa code and its history are imported into this independent repository, with WEG-specific changes under stacked Draft PR review. The local application is **synthetic/test-only**, not ready to manage real properties, personal data or money. Start with [STATUS.md](STATUS.md).

## Vision

A property owner or manager should be able to take a photo of a defect, scan an invoice, upload a contract, or simply ask a question in German. The assistant should prepare the next steps, identify missing facts, draft editable documents, suggest suitable trades, and keep track of deadlines.

The AI prepares. Authorized humans review, correct and approve. Only then may an explicitly connected integration perform an external action.

### Example: Leaking pipe
1. Upload a photo and optionally dictate: "Im Keller tritt Wasser aus".
2. Detect **possible** hazard; immediately show safety guidance and an emergency contact route.
3. Create an evidence-backed case; ask only for necessary missing facts.
4. Propose a maintenance ticket and contractor categories/shortlist (using live sources when connected).
5. Prepare editable email requests, a comparison of real offers, and a draft WEG resolution if required.
6. Require human approval for external messages, orders, payments, and legally relevant decisions.
7. Track replies, work, invoices and documentation in a single audit trail.

## Building blocks

- **Source intake:** PDF, scans, photos, email, user text and voice transcription.
- **Case workspace:** context, evidence, AI proposals, human edits, approvals, timeline.
- **Deterministic core:** WEG accounting, voting and legal rules; no financial calculations delegated to an LLM.
- **Integrations:** HaVeWa modules/API/MCP, with least-privilege tokens.
- **Privacy:** strong tenant/unit isolation, local AI option, PII-minimized external model access.

## Current status and agent handoff

- **[STATUS.md](STATUS.md)** — verified completed work, live branch/PR/CI state and blockers (start here).
- **[ROADMAP.md](ROADMAP.md)** — canonical gate-by-gate roadmap, including Dashboard/PWA and MyHammer.
- **[HANDOFF.md](HANDOFF.md)** — next-agent procedure with sources, risks and exact follow-up.
- **[AGENTS.md](AGENTS.md)** — Ponytail/Lazy Admin engineering rules, security and UX requirements.
- [Dashboard usability design](docs/weg-homemanager/UX_DASHBOARD.md)
- [MyHammer & Handwerker marketplaces](docs/weg-homemanager/CONTRACTOR_MARKETPLACES.md)
- [Reuse-first policy](docs/weg-homemanager/REUSE_POLICY.md)
- [Single-PC Windows deployment checklist](docs/weg-homemanager/SINGLE_PC_INSTALLATION.md)
- [Gmail WEG mailbox + Windows launcher without Docker](docs/weg-homemanager/MAILBOX_AND_LOCAL_LAUNCH.md)
- [Guided Dashboard, persistent uploads, sample WEG and meeting proposals](docs/weg-homemanager/UX_GUIDED_E9.md)
- [AI document understanding: classification, quoted facts and next steps](docs/weg-homemanager/AI_DOCUMENT_TRIAGE.md)
- **Windows quick start:** double-click `start-weg-homemanager.cmd` while PostgreSQL is running (native Windows service or existing Docker test container).

**UX:** responsive novice-friendly WebGUI in the intended HaVeWa Next.js architecture; PWA as a progressive improvement. No separate desktop/native stack for the first release.

## Current deliverables

- [Product vision](docs/weg-homemanager/PRODUCT_VISION.md)
- [AI-first architecture and contracts](docs/weg-homemanager/AI_FIRST_ARCHITECTURE.md)
- [Security and approval policy](docs/weg-homemanager/SECURITY_AND_APPROVALS.md)
- [Roadmap and acceptance criteria](ROADMAP.md)
- [Upstream integration notes](docs/weg-homemanager/UPSTREAM_INTEGRATION.md)
- [Standalone case-state prototype](prototype/ai-case/README.md)

The standalone prototype uses synthetic evidence and mock proposals; it performs **no OCR, no actual contractor search, no email sending and no payments**.

## Upstream and licensing

Imported base: [HaVeWa](https://github.com/fgilde/hausverwaltung) by Florian Gilde. Upstream history and attribution are preserved. The code is subject to AGPLv3; HaVeWa also offers a separate commercial-licensing option. Review AGPL obligations before distribution and keep upstream notices intact.

## Development

Use **Node 24+** for the PDF inspection subprocess. Useful checks: `npm test`, `node --test prototype/ai-case/engine.test.mjs`, `npm run build`, and `node scripts/e6-worker-package-smoke.mjs` (works without production database). On Windows, run the **read-only** `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e6-single-pc-preflight.ps1` and resolve all FAIL results before working with real users. There is no production installer yet.

No actual apartment owner data, bank account numbers, authentication tokens or private property documents belong in Git.
