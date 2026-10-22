# WEG HomeManager — engineering handoff for next agent

**Date:** 2026-10-22
**Repo:** https://github.com/mrAibo/WEG_HomeManager
**Canonical docs:** `AGENTS.md`, `STATUS.md`, `ROADMAP.md`
**Primary architecture:** existing HaVeWa Next.js/TypeScript/PostgreSQL/Prisma reused; mobile-first Dashboard and future PWA.
**Device/local path:** Aibo / `C:\Users\crown\Downloads\Projects\WEG_HomeManager`

## User decisions — do NOT ask again
AI-first, Lazy Admin, highest priority novice usability. Upload photo/scan, ask in German, agent researches/organizes real evidence and suggests editable documents and actions. Human explicitly approves consequential sends, orders, bookkeeping and decisions. Reuse upstream/stdlib/native/browser/dependencies per Ponytail before writing code. No native rewrite, no unsanctioned MyHammer bots/scraping. Use synthetic fixtures; never commit real WEG data.

## What was built and verified
- PR #1 (Draft) contains product docs and stand-alone in-memory AI approval prototype; 8 Node tests passed.
- On 22 Oct 2026 a separate local branch `integration/havewa-baseline` was created from `feature/ai-first-foundation`.
- Exact upstream HaVeWa SHA `cb130792cfe40444c35827d059900f3b552a9af4` merged with unrelated-history merge, so source history preserved.
- One conflict: README. WEG HomeManager README kept; upstream README stored at `docs/upstream/README-HaVeWa-original.md`; upstream `README.de.md` and AGPLv3 license remain.
- GitHub Actions from upstream that would publish GHCR images, Pages or CasaOS releases were archived under `docs/upstream/disabled-workflows` to avoid an accidental release.
- `vitest.config.ts` excludes `prototype/**` so Vitest does not try to run standalone Node tests.
- Windows / Node v24.19.0 / npm 12.2.0: `npm ci` PASS (851 packages), `npx prisma generate` PASS, `npm test` PASS 199/199 with 1 skipped, `node --test prototype/ai-case/engine.test.mjs` PASS 8/8; `npm run build` PASS.
- `npm run lint` fails on inherited baseline (90 errors, 21 warnings). Do not hide/disable blanket rules.
- Docker Desktop/PostgreSQL 16 now running with container `havewa-db`, bound ONLY to `127.0.0.1:5432`; all 62 migrations applied successfully. Secure random local-only `AUTH_SECRET` stored in ignored `.env` (not in Git). Next.js server started on `http://127.0.0.1:3000` (Windows shell PID `72132` at execution); GET `/` and `/setup` returned HTTP 200 with expected `/de/setup` flow. No admin account created and no UI clickthrough; use browser locally on Aibo to finish synthetic setup.
- GitHub Actions integration baseline ran successfully: https://github.com/mrAibo/WEG_HomeManager/actions/runs/39765475490 at commit `e44763ace62fefd992f5267f48f321353847bc06`. Full tests documented in `docs/weg-homemanager/BASELINE_VERIFICATION.md`.

## Security increment on 2026-10-22 (review branch `fix/e1-mcp-readonly`)
- Inspected HaVeWa MCP: original `create_task`, `create_ticket`, `create_person`, generic CRUD and `run_operation` were exposed to any permitted Bearer principal. Bearer login does not establish human approval.
- Added `src/lib/mcp-tool-policy.ts` as explicit fail-closed allowlist. MCP `tools/list` filters and `tools/call` independently denies every name not explicitly read-only.
- Added 13 tests in `src/app/api/mcp/route.test.ts` (direct write invocation, unknown future tool, auth, safe read). All passed. Targeted ESLint and `tsc --noEmit` passed; full `npm test` (212 passed + 1 skipped), prototype (8 passed) and Next.js build passed. Baseline build warnings persist.
- Important: REST `/api/v1` and existing server actions have NOT been secured by this change. Do not issue broad bearer tokens to AI or enable model-controlled REST writes. Issue #11 remains P0 until token purpose, per-object authorization and durable approvals are implemented.
- Check review PR and actual HEAD/CI before continuing. Keep both existing Draft PRs unmerged.

## E2 Dashboard UI increment (2026-10-22)
- Branch `feature/e2-safe-intake-ui` stacks onto `fix/e1-mcp-readonly` (Draft PR #12); source commit `e7522796db27f287d3cbe5f0146376455c23e65b`, Draft PR #13 https://github.com/mrAibo/WEG_HomeManager/pull/13. Linux CI run 39772511128 **success** at this source SHA; E1 security PR #12 Linux CI 39769989837 **success**. No merges into main/integration.
- Existing `src/app/[locale]/(admin)/dashboard/page.tsx` now renders `CaseIntake` above legacy KPI widgets. It reuses Next.js, shadcn cards/buttons and browser file pickers. No second frontend or dependencies.
- `src/lib/case-draft.ts`: deterministic local editable template for photo/document/question with six tests. This is **not an LLM**, OCR, uploaded/saved file, persisted Case, WEG approval or send. File input retains only metadata client-side. Manual checkbox review is not a durable authorization record; changing draft revokes it.
- Synthetic onboarding: localhost test admin + one fake property created. Credentials held outside repo in sibling local-only JSON; never commit or disclose. 62 Prisma migrations were already present. No actual six-unit fixtures yet.
- Actual Chrome/Playwright one-off smoke: authenticated Dashboard at `http://127.0.0.1:3000/de/dashboard`, draft generation, edit revokes review, copy after re-review, mobile 360px horizontal-overflow false — PASS. `scripts/e2-ui-smoke.mjs` is a credential-by-environment reproducible smoke test; automated rerun is not yet in CI.
- Next: persistent Case/Proposal/Approval with transaction-scoped RBAC, durable audit and idempotency; safe document upload and AI evidence pipeline. Test no-write and denied permission. Do not confuse the local-only review checkbox with legal approval.

## E3 transactional review-core increment (2026-10-22)
- Work branch: `feature/e3-case-approval-core` based on E2 Draft PR #13 (`19dd2e187159f83e2fcdef0f90f8110c1d1d9864`). E3 source commit `029f79c8e1e39224fd7ef405bb1d329c26b1818d` at [Draft PR #14](https://github.com/mrAibo/WEG_HomeManager/pull/14). Linux CI [run 39778815659](https://github.com/mrAibo/WEG_HomeManager/actions/runs/39778815659) SUCCESS. Do not merge any stacked draft automatically.
- HaVeWa reusable modules confirmed: `Ticket`, `Document`, `src/lib/storage.ts`, `src/server/actions/maintenance.ts`; `src/lib/audit.ts` is best-effort and must NOT back binding approval evidence.
- Added Prisma models `AiCase`, `AiProposal`, `AiApproval`, `AiCaseEvent` and migration `20261022122326_weg_ai_case_approval`. Postgres synthetic-only `npx prisma migrate deploy` + `migrate status`: 63 migrations PASS. Only new additive migration, no old tables changed. Upstream has no new commits beyond imported `cb130792c`.
- Server-only-by-location workflow `src/server/ai-case-workflow.ts`: manager-only case creation, SHA-256 hashes, explicit `COPY_ONLY` review, optimistic exact-version updates, stale/replay rejection, atomic case event logging. The service has **no API/MCP endpoint**, external executor, upload or AI integration. Human identity MUST be obtained from authenticated session when wiring server actions, not from a client-supplied actor.
- New policy helpers and 10 unit tests `src/lib/ai-case-policy*` + `scripts/e3-db-smoke.ts`. Real local synthetic DB smoke validates tenant/property denial, role denial, version mutation, approval invalidation/replay and atomic event history; cleans its own inserted records. TypeScript, changed-file ESLint, 228 Vitest, 8 Node prototype and Next production build passed. Documented existing build warnings persist.
- Full Case/Evidence and human approval UI is still unimplemented. Next engineering step: server action with `requireUser` and explicit allowed role, hook dashboard to DB (no file upload until safe evidence design), list/view/edit/submit/review/copy current version and re-run browser security tests. No model API tokens and never auto-send.
- Existing synthetic administrator credentials are stored locally outside the repo. Never commit them or real WEG personal data.

## E3 authenticated saved-Case UI increment (2026-10-22)
- Work branch `feature/e3-saved-case-ui` stacked on E3 core Draft PR #14; [Draft PR #15](https://github.com/mrAibo/WEG_HomeManager/pull/15) source commit `6c131cc4556ae762ae377cc0bb402b171ab5e727`; Linux CI source run 39792137478 pending at PR creation. No merges. Started from clean `aa29a2a27feb39928161011fb08ce7edd9900204`, fetched origin and upstream. 63 local migrations up to date.
- Dashboard `CaseIntake` has explicit save button for ADMIN/VERWALTER: saves **text-only** proposal through session-bound `src/server/actions/ai-cases.ts`; photo and document selections are local metadata only, not uploaded. No LLM/OCR/automatic side effects.
- New `/cases` list and `/cases/[id]` tenant-scoped server pages + `CaseReview` client: edit/propose for review/approve COPY_ONLY, with manual approval checkbox and server-verified copy. Underlying persisted E3 service already rejects stale version, disallowed roles and cross-tenant access. Action code never accepts actor from client.
- Chrome/Playwright synthetic end-to-end saved workflow PASSED (create, reload, revise v2, submit, human approve, copy, mobile 360 px no overflow) on locally bound Next.js. Script `scripts/e3-ui-smoke.mjs` requires synthetic `WEG_SMOKE_EMAIL` ending `.invalid`, `WEG_SMOKE_PASSWORD` and loopback `DATABASE_URL`. Test cleans only its generated Case rows.
- Initial UI smoke exposed stale App Router proposal state after `router.refresh()`; fixed with full browser reload after committed mutation. This is safe but produces visible navigation; refine later with robust cache invalidation.
- E3 action Vitest 7/7 PASS; full Vitest 235 PASS, 1 SKIP, prototype 8 PASS, production build and TypeScript PASS, changed-file ESLint PASS. No new migrations or dependencies. Next: safe file evidence & stored original hashes, object authorization, duplicate-case idempotency and UX without hard reload. Need complete E3 before any AI or side effects.
- Credentials exist only outside Git in local synthetic test fixture; never commit them.

## E3 Evidence uploads and protected download (2026-10-22)
- Work branch `feature/e3-evidence-upload` stacked on `feature/e3-saved-case-ui` PR #15, started at clean `12541b059e26bc8fc27ec7bf50164271b73101f0`; source commit `5f8d8198fae42d10dd500631c42a6993660ef3a4`, [Draft PR #16](https://github.com/mrAibo/WEG_HomeManager/pull/16). Upstream unchanged, PR chain remains Draft.
- New additive Prisma `AiEvidence` tenant+case FK, SHA-256 content digest, immutable API semantics, unique case+hash and storage key. Migration `20261022154639_weg_ai_case_evidence` applied on synthetic local PostgreSQL: **64 migrations**, no production DB touch.
- Reuse `src/lib/storage.ts` HaVeWa file adapter (random local storage keys); validates file magic+tail for JPG/PNG/PDF max 10 MiB. Downloads through new Auth.js/session-guarded GET `/api/cases/[id]/evidence/[evidenceId]`, attachment-only, no-store, nosniff/sandbox, byte hash checked before serving.
- Authenticated upload Server Action `src/server/actions/ai-evidence.ts` calls `addCaseEvidence` with session-derived tenant/actor only; rejects other tenant, non-manager and post-review. DB transaction locks proposal in DRAFT, stores Evidence + event together, attempts to remove newly saved file on DB error. Copy-only approval invariant remains.
- Dashboard `CaseIntake` now saves selected file with explicitly saved Case, showing partial success if attachment fails. Detail page `/cases/[id]` shows evidence hashes/download and optional file upload only while DRAFT; no OCR/LLM.
- Tests: 22 new Vitest (policy, auth action, protected download), full Vitest 257 PASS 1 SKIP, prototype 8 PASS, TypeScript, changed-file ESLint, Next production build PASS. `scripts/e3-evidence-db-smoke.ts` and `scripts/e3-evidence-ui-smoke.mjs` ran against synthetic localhost DB and Chrome: exact file bytes verified on download, unauthorized 401, post-review cannot upload, 360px mobile. Both clean their own records/file bytes. CI browser/db smoke not wired.
- Next: review PR and CI first; strengthen validation/antivirus for untrusted uploads, retention/backups of storage, evidence-to-proposal hash binding, role/object matrix and REST bearer token restrictions #11. Then OCR/LLM with opt-in provider and DPIA. Keep releases disabled, Draft PRs unmerged, no real personal data.

## E3 Evidence snapshot integrity (2026-10-22)
- Work branch `feature/e3-evidence-snapshot` stacked on Evidence PR #16; source commit `ef0a17fc0325b10f538146df1540a139fd36db62`, [Draft PR #17](https://github.com/mrAibo/WEG_HomeManager/pull/17), source Linux [run 39813718593](https://github.com/mrAibo/WEG_HomeManager/actions/runs/39813718593) in progress at PR creation. Started clean at `a5ad6096dd7c45d5521a1b95623e337cece4feea`; upstream unchanged. Do not merge existing draft chain.
- Prisma migration `20261022161638_weg_evidence_approval_snapshot` adds nullable `AiProposal.evidenceSha256` / `AiApproval.evidenceSha256`; synthetic loopback DB now 65 migrations. **Legacy approvals with no Evidence snapshot fail closed**.
- `src/server/ai-evidence-snapshot.ts` hashes canonical list of Evidence rows and verifies exact disk bytes; max 10 files. Submission locks proposal before reading files, stores manifest in reviewed proposal. Approval and later clipboard copy check manifest and bytes. Missing/tampered files forbid action. UI displays digest. Shared CaseWorkflowError moved into `src/lib/ai-case-errors.ts`.
- Unit tests: +5 manifest tests, full 262 PASS 1 SKIP, prototype 8 PASS, targeted ESLint and TypeScript PASS, Next build PASS. Actual synthetic database tamper/recover/tamper-after-approval integration PASS; previous DB Evidence smoke and both authenticated Chrome scripts passed (including file download, mobile 360px).
- No malware scanner, AI/OCR, external sends or production personal data. Next: full coordinated PostgreSQL+file-store backup/restore drill and retention/security audit, followed by safe OCR/provider choice and explicit DPIA if personal data would leave local environment.

## E3 coordinated backup and isolated restore drill (2026-10-22)
- Work branch `feature/e3-backup-restore-drill`, stacked on Evidence snapshot PR #17; started from clean `896629a489cb828a8ee819447093ca431cea5060`. PR #17 GitHub Actions run 39813824764 SUCCESS, upstream unchanged.
- `scripts/e3-backup-restore-drill.ts`: synthetic-only guardrails (localhost DB `havewa` on 5432, sole `WEG Demo – Sechs Wohnungen` tenant, all account emails `.invalid`, local Next.js 3000 stopped, exact Docker `havewa-db`). Seed fake Case/PDF, submit and COPY_ONLY approve, back up `pg_dump -Fc` + all private `storage/documents`, checksum file snapshot, restore into unique `weg_restore_<uuid>` scratch Postgres DB and private scratch file folder, validate recovered Case + human approval + all Evidence SHA256 hashes, remove scratch DB/dump/folder and test Case.
- Actual execution: `E3_COORDINATED_RESTORE_PASS`. Post cleanup verified original DB Case/Evidence counts 0, local storage files 0, scratch database count 0. Original DB/storage never restored over.
- `docs/weg-homemanager/BACKUP_RESTORE_RUNBOOK.md`: read before production design; **all writers must be quiesced** to capture corresponding DB+file state. Current script is not a backup scheduler or production DR/PITR system. Avoid committing any dump or private content.
- Source commit `5fdb0a399513b1ef9751b7d7b81feaad4654ba5a` in [Draft PR #18](https://github.com/mrAibo/WEG_HomeManager/pull/18), stacked on #17; [Linux Actions run 39817277134](https://github.com/mrAibo/WEG_HomeManager/actions/runs/39817277134) started on source commit. Full Vitest 262 PASS / 1 SKIP, prototype 8 PASS, ESLint/TypeScript/Next build PASS. App restarted on loopback, `/de/login` 200. No migrations changed from 65.
- Next: review linked Draft PR / CI, real file malware/structure security, retention/DSGVO, per-object access logging and REST bearer P0 #11. Before production: encrypted offsite backup/restore under controlled maintenance. No OCR/model or external writes yet.

## E3 Evidence structural intake gate (2026-10-22)
- Branch `feature/e3-evidence-structural-validation` stacked on Draft PR #18. Started clean at `36f93b5d5e6d258455566e9e29cfa3edbe54f471`. HaVeWa upstream unchanged.
- Added `src/lib/ai-evidence-inspection.ts` structural pre-store check called by `src/server/ai-evidence-workflow.ts` before file persistence. Existing `pdf-lib` validates PDF page tree; prohibits active actions/embedded files/encrypted/unsupported PDFs. PNG chunk lengths/CRC and dimensions validated, unsupported ancillary text rejected. JPEG SOF/SOS marker and dimensions bounded; compressed image decoding and virus scan NOT performed.
- No ClamAV on Aibo. Bad bytes are rejected without ever being stored, not "quarantined". Docs `docs/weg-homemanager/EVIDENCE_INGEST_SECURITY.md` define true quarantine/antivirus/sandbox requirements before real files. UI warns tests only.
- Replaced pseudo-PDF fixtures in four synthetic DB/Chrome/restore scripts with actual pdf-lib-generated PDFs. 11 new Vitest tests, total 273 PASS / 1 SKIP, TypeScript, lint of changed files, production build PASS. DB security/snapshot smokes, coordinated full scratch restore, local Chrome saved Case and PDF Evidence flow PASS.
- No new migrations/dependencies/production data/external sends. Next: scoped scanner with isolated quarantine and allowlisted byte-signature attestation, robust parser under OS sandbox, REST Bearer P0 #11, GDPR retention and per-object auditing.

## Required first actions
1. `git status --short --branch` and `git fetch origin upstream`, inspect any commits newer than this handoff; never overwrite newer work.
2. Inspect current PR #1 and a separate integration Draft PR (check GitHub; do not assume merged).
3. Read canonical files and licenses. Record exact current HEAD in STATUS when moving branches.
4. Evaluate security of existing HaVeWa `src/app/api/mcp/route.ts`, `src/lib/api-auth.ts`, server actions, tenant scope and uploads BEFORE enabling model write tools.
5. Review inherited lint failures; fix only with scoped changes and tests. Check CI Linux npm 12 script blocking/Prisma generation.
6. Existing synthetic-only Postgres and local UI are now running. Finish fresh administrator setup on `http://127.0.0.1:3000` using local, secure credentials and validate Dashboard, tickets and documents; do not use demo `admin/admin` credentials.
7. First user-facing milestone: Dashboard `Was kann ich für Sie erledigen?`, `Foto aufnehmen`, `Dokument hochladen`, `Frage stellen`, `Jetzt wichtig`, `Zur Freigabe` and edit/approve work package.
8. Do not overclaim OCR, payments or contractor discovery; first case workflow is still a pure prototype.

## Git hygiene
- Never force push main, merge a Draft PR without review, or commit private docs/credentials.
- Preserve AGPLv3 `LICENSE`, `LICENSING.md`, authorship and upstream sync link.
- Local `node_modules` and Next build files should remain ignored.
- New root `ROADMAP.md` is canonical; older nested roadmap points to it.
- Work on reviewable short branches/PRs and update STATUS and HANDOFF with verified results.

## Integration specifics
- Integration branch derives from `feature/ai-first-foundation` (which is not yet merged into main). Therefore merge order must be decided deliberately: review/merge PR #1 first or rebase/cherry-pick the integration on main **without force-pushing or losing work**.
- The independent repository is not GitHub fork=true; don't claim otherwise.
- Upstream automatic release workflows are intentionally disabled in this fork.
- Potential licensing: AGPLv3 derivative, or separate commercial license from HaVeWa rights holder if proprietary.
