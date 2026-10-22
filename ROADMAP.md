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
- [x] PostgreSQL 16 local-only dev DB started, all 62 Prisma migrations successful and Next.js setup wizard verified HTTP 200 on localhost.
- [x] Linux GitHub Actions integration test/build passed at baseline commit `e44763ace62fefd992f5267f48f321353847bc06`.
- [x] E1 security increment: fail-closed read-only MCP discovery AND invocation allowlist (13 tests); no MCP writes enabled. This is not full P0 closure: REST write tokens, server actions, tenant-object RBAC, versioned approvals and audit remain.
- [ ] Resolve/triage inherited lint failures (90 errors, 21 warnings); dependency/secret/security review, tenant scopes, REST write token safety, real UI clickthrough and backup restore remain open.
- [ ] Assess current dashboard, tickets, documents, banking and financial calculation implementation before modifying.
- [ ] Prepare deterministic 6-unit synthetic dataset (also 12 and 50 unit variants).
**Gate:** Repeatable builds; source provenance and a scoped feature gap map, no real user data.

## E2 — User-first Dashboard and design system (P0; [Issue #7](https://github.com/mrAibo/WEG_HomeManager/issues/7); parallel UX specification before E1, implementation after E1)
- [x] First guarded UI increment on top of MCP security: primary German intake on existing HaVeWa dashboard, native photo/document pickers, question, editable deterministic text draft, explicit review and copy-only manual handoff. No AI/OCR/upload/persistence or sends; this is NOT the complete vertical Case slice. Local desktop and 360px smoke passed on synthetic tenant.
- [x] First **text-only** persisted Case + versioned human COPY_ONLY review UI, with explicit absence of file upload/OCR/AI.
- [ ] Next milestone: evidence-backed photo/document uploads, provenance, secure storage and real AI/OCR with human review. Current file picker does not transmit its contents.
- [ ] Mobile-first responsive web UI; PWA installability if supported by native web/browser primitives without scope creep.
- [ ] German interface, conversational input, three capture actions: photograph, upload/scan, ask/speak.
- [ ] Role-aware **"Was ist heute wichtig?"**: urgent cases, AI drafts awaiting review, pending responses, deadlines, bills and reserve summary.
- [ ] Case-oriented navigation; one overview and clear primary next action per card. Progressive disclosure rather than separate confusing "novice/expert" applications.
- [ ] Editable proposal review, clear approval scope, undo drafts, explicit errors and upload progress.
- [ ] Accessible typography, contrast, touch targets, keyboard focus, plain German and screen reader support; aim WCAG 2.2 AA.
- [ ] Moderated usability sessions with 3–5 inexperienced people per iteration. Measure task completion, error rate and comprehension; avoid made-up success claims.
**Gate:** In usability tests, a novice can create/review one case with minimal help. Record observed times rather than promises.

## E3 — Persistent AI Case and trusted approvals (P0; Issue #3)
- [x] Initial **transactional COPY_ONLY core**: `AiCase`, versioned `AiProposal`, persistent `AiApproval` and `AiCaseEvent`, compound tenant FKs, SHA-256 and optimistic revision guard; no AI-authored actions and no outbound executor. 63rd migration applied to localhost synthetic DB and DB security-smoke passed.
- [x] Authenticated Dashboard saving and `/cases` list/detail/review UI: human manager-only server actions, tenant-filtered data, versioned edit/submit/approve, approved COPY_ONLY text fetched from DB. Seven auth/security unit tests + actual Chrome/PostgreSQL full flow and mobile 360px pass. No binary evidence or actual AI yet.
- [x] E3 first immutable Evidence layer: original bytes in existing HaVeWa `storage`, tenant/case composite FK + per-file SHA-256, restricted PDF/JPEG/PNG signatures, size cap, explicit user upload, guarded download and audit event. Synthetic DB + Chrome passed.
- [x] Bind review and COPY_ONLY approval to canonical SHA-256 Evidence manifest, recalculate original file hashes before submit/approval/copy, refuse tampered or missing files, lock proposal against concurrent uploads, enforce max 10 Evidence per Case. Synthetic tamper-and-repair DB test PASS.
- [x] E3 **synthetic-only coordinated backup/restore drill:** full local PostgreSQL custom-format dump + copied HaVeWa `storage/documents`, restored into isolated scratch DB and filesystem; tenant, Case, approval, manifest and every file hash verified, cleanup confirmed. `docs/weg-homemanager/BACKUP_RESTORE_RUNBOOK.md` includes quiescence rules.
- [ ] Production-ready backup hardening: all-writer maintenance freeze, encrypted offsite backups and retention, **PITR / WAL**, scheduled alerts, staging/production disaster cutover and regular restore drills; do not equate the synthetic verification with full DR readiness.
- [x] Conservative **pre-storage structural inspection** of PDF/JPEG/PNG: real pdf-lib parse, action/object denylist, PNG chunk CRC/limits, JPEG bounded marker checks; 11 negative/positive tests, synthetic DB/Chrome and scratch restore PASS. Rejected bytes never stored; NOT an antivirus scan.
- [x] E4 immediate **P0 REST Bearer write lockdown**: all `/api/v1/**` POST/PATCH/PUT/DELETE forbidden by route-level 403 plus central authentication refusal; 28 focused tests, real HTTP/GUI smoke, no MCP/WebGUI regression. Breaks legacy REST write integrations intentionally.
- [ ] E4 follow-up: scope/revoke Bearer read tokens, enumerate other privileged routes, explicit per-action human executor with replay-safe receipts, tenant/object RBAC and legal approvals before any live actions. Keep GitHub Issue #11 open.
- [x] E5 isolated PDF structural parsing: Node 24 child with `--permission` filesystem allowlist, no inherited DB/auth secrets, 8s deadline, 128 MiB V8 heap and at most two concurrent workers, fail closed. This reduces in-process parser risk but is not a network/OS-level sandbox.
- [x] E6 **read-only single-PC Windows preflight + package smoke**: check Node 24, generated Next build, local DB/HTTP bind, demo credentials, NTFS Evidence ACLs, host AV and dedicated identity; synthetic worker+recursive pdf-lib deps extracted to temp and fail-closed package run verified. Safe fresh-DB Compose example and runbook. **Not a production installer or host hardening action.**
- [ ] Single-PC security baseline remaining: rotate demo DB password for **fresh production DB**, provision low-privilege service account, verify real antivirus coverage and WEG storage ACLs, worker no-egress OS sandbox, process memory limits, signed installer and backup/recovery under service identity.
- [ ] Evidence hardening: quotas, retention/DSGVO, source citations, streaming/per-object audit and security fixtures. Separate ClamAV/quarantine **not required by current user plan**, reassess only if external untrusted uploads or organizational policy demand it.
- [ ] Durable scoped execution + idempotency only after authorization/security audit; no model-controlled REST writes or external side effects.
- [ ] Case/Evidence/Proposal/Approval/Execution/Audit models with immutable source originals and versioning.
- [ ] Enforce server-side per-tenant and per-object RBAC, provenance and prompt-injection separation.
- [ ] Human edits revoke approvals; durable approval trail, idempotent execution, no AI external writes by default.
- [ ] Bind to existing HaVeWa ticket/document APIs; no reimplementation of WEG ledger.
**Gate:** Test from a real saved case through human-approved draft, but no unsanctioned side effects.

## E4 — Photo, PDF, invoice and letter understanding (P1; Issue #4)
- [x] Browser camera/file picker now supports explicit JPEG/PNG/PDF evidence upload into saved Case through reused HaVeWa storage (no extraction yet).
- [x] E7 **pluggable AI Document Recognition MVP**: existing tenant-chosen Anthropic/OpenAI-compatible provider+model, explicit document consent, image/PDF payload adapters, untrusted JSON transcription, separate Evidence-hash-bound persisted draft and human-edited approval status. Synthetic DB and local fake-provider browser tests PASS; no live model requests.
- [ ] Before real vision/handwriting deployment: validate selected affordable models on authorized documents, GDPR/AV/provider terms, optional field extraction with page evidence and correct unreadable abstention; controls for cost, rate limiting and external-host policy.
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
