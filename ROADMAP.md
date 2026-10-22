# WEG HomeManager — canonical roadmap (AI-first / Lazy Admin)

**Updated:** 2026-10-22. **Work in progress:** HaVeWa E1 integration exists in separate review branch `integration/havewa-baseline`; source merged locally, 199 upstream + 8 prototype tests pass and Next.js build passes, but lint reports 90 errors / 21 warnings and DB/functional/security audits remain. See `STATUS.md` and `docs/weg-homemanager/BASELINE_VERIFICATION.md`.
Single source of truth for priorities. See [STATUS](STATUS.md), [HANDOFF](HANDOFF.md), [UX](docs/weg-homemanager/UX_DASHBOARD.md), [marketplaces](docs/weg-homemanager/CONTRACTOR_MARKETPLACES.md).

## Success criterion
A first-time nontechnical German-speaking user can understand the Dashboard, capture a problem by photo, review/edit the proposed action, and know exactly what happens next. AI handles preparation; only authorized people execute consequential actions. No hidden automation or uncertain claims.

## E0 — Foundation / handoff (DONE as docs + prototype, PR #1 draft)
- [x] Vision, basic architecture, human approval prototype and 8 successful automated tests at previously checked revision.
- [x] Portable Ponytail agent instructions; WebGUI/PWA UX choice and marketplace policy.
- [x] STATUS, handoff and stage-gated development roadmap.
- [ ] Merge PR #1 **only after review**. No claim of production readiness.

## E1 — HaVeWa upstream reuse (P0 / next; Issue #2)
- [x] Import preserved HaVeWa baseline (original AGPL license, attribution, exact upstream SHA and sync remote) into separate integration branch.
- [x] Reuse Next.js App Router / TS / PostgreSQL / Prisma / shadcn/ui / Tailwind, Auth.js, REST and MCP; avoid another frontend/backend stack.
- [x] Run upstream tests (199 passed + 1 skipped), isolated Node case tests (8 passed), and Next.js production build (pass).
- [ ] Resolve/triage inherited lint failures (90 errors, 21 warnings); database migrations, dependency/secret/security review, tenant scopes and AI write tool safety remain open.
- [ ] Assess current dashboard, tickets, documents, banking and financial calculation implementation before modifying.
- [ ] Prepare deterministic 6-unit synthetic dataset (also 12 and 50 unit variants).
**Gate:** Repeatable builds; source provenance and a scoped feature gap map, no real user data.

## E2 — User-first Dashboard and design system (P0; [Issue #7](https://github.com/mrAibo/WEG_HomeManager/issues/7); parallel UX specification before E1, implementation after E1)
- [ ] Mobile-first responsive web UI; PWA installability if supported by native web/browser primitives without scope creep.
- [ ] German interface, conversational input, three capture actions: photograph, upload/scan, ask/speak.
- [ ] Role-aware **"Was ist heute wichtig?"**: urgent cases, AI drafts awaiting review, pending responses, deadlines, bills and reserve summary.
- [ ] Case-oriented navigation; one overview and clear primary next action per card. Progressive disclosure rather than separate confusing "novice/expert" applications.
- [ ] Editable proposal review, clear approval scope, undo drafts, explicit errors and upload progress.
- [ ] Accessible typography, contrast, touch targets, keyboard focus, plain German and screen reader support; aim WCAG 2.2 AA.
- [ ] Moderated usability sessions with 3–5 inexperienced people per iteration. Measure task completion, error rate and comprehension; avoid made-up success claims.
**Gate:** In usability tests, a novice can create/review one case with minimal help. Record observed times rather than promises.

## E3 — Persistent AI Case and trusted approvals (P0; Issue #3)
- [ ] Case/Evidence/Proposal/Approval/Execution/Audit models with immutable source originals and versioning.
- [ ] Enforce server-side per-tenant and per-object RBAC, provenance and prompt-injection separation.
- [ ] Human edits revoke approvals; durable approval trail, idempotent execution, no AI external writes by default.
- [ ] Bind to existing HaVeWa ticket/document APIs; no reimplementation of WEG ledger.
**Gate:** Test from a real saved case through human-approved draft, but no unsanctioned side effects.

## E4 — Photo, PDF, invoice and letter understanding (P1; Issue #4)
- [ ] Reuse browser camera/file inputs and existing document handling; OCR/vision via pluggable provider rather than custom model.
- [ ] Source-linked extraction and field-level corrections; missing facts and confidence visible.
- [ ] Safety-first escalation for emergencies. No invented diagnoses from an image.
- [ ] Letters: dates, deadlines and editable response drafts.
**Gate:** Golden image/PDF fixtures plus injection tests; nontechnical user can correct AI errors.

## E5 — Handwerker & tender workflow (P1; [Issues #5](https://github.com/mrAibo/WEG_HomeManager/issues/5) / [#8](https://github.com/mrAibo/WEG_HomeManager/issues/8))
- [ ] AI drafts a scoped job brief with measurements, photos and verified WEG authorization.
- [ ] Compare contractors from authorized sources, user-created supplier list and live quotes with citations and timestamps.
- [ ] MyHammer **assisted handoff only** in MVP: copy approved job text/photos and open official listing form; user posts manually. Do NOT scrape or auto-post without an authorized provider API and compliant contract.
- [ ] Optional Blauarbeit / CHECK24 Profis via the same vendor-neutral handoff design.
- [ ] Compare actual quotes (total gross, schedule, scope, liability, warranty and references), prepare editable award draft.
- [ ] Track status and record authorization, avoid duplicate publication of a job.
**Gate:** End-to-end demo with mock quotes; no fake real-time availability.

## E6 — Accounting and WEG legal correctness (P1; Issue #6)
- [ ] Reuse HaVeWa ledger, Wirtschaftsplan, Jahresabrechnung, Rücklagen and Beschlüsse.
- [ ] Independent exact-cent reconciliation tests; six synthetic MEA shares sum to 1000.
- [ ] Scanned invoice extraction -> match order -> suspicious payment field check -> correctable posting suggestion.
- [ ] Voting rules tied to currently effective legal sources / Gemeinschaftsordnung and specialist review.
- [ ] Professional validation before real WEG administration.
**Gate:** Explainable and reproducible reports; no payments without verified authorization.

## E7 — Product hardening (P2)
- [ ] Measured performance, multilingual extension, accessibility test suite and meaningful onboarding.
- [ ] Role-based owner portal, property manager and Selbstverwaltung workflows.
- [ ] GDPR/privacy contracts, disaster recovery drill, tested exports, user manuals and support.
- [ ] Choose AGPL versus commercial licensing for future distribution.
**Gate:** Independent security and accounting review plus real user pilot approval.

## Out of scope until evidence of demand
- Native desktop/mobile rewrites, separate Rust backend, custom OCR model, uncontrolled multi-agent chat system, automated MyHammer bots/scraping, autonomous contracts or bank transfers.
- Features duplicated by mature upstream HaVeWa modules or OS/browser-native functions.

## KPI candidates (targets, not achieved metrics)
- New user's first case and draft review without training.
- Understood and accepted AI uncertainty with source evidence.
- No unauthorized external actions, no cross-tenant leaks and no broken audit chain.
- Task completion, accessibility testing and manual correction rate tracked with synthetic pilot data.
