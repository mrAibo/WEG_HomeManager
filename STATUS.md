# WEG HomeManager — STATUS (canonical)

**Verified on:** 2026-10-22, Europe/Berlin
**Repository:** https://github.com/mrAibo/WEG_HomeManager
**Current focus:** E1 — HaVeWa integration baseline with no real WEG data.
**Local working tree:** `C:\Users\crown\Downloads\Projects\WEG_HomeManager` (Aibo, Windows)
**Branch:** `integration/havewa-baseline` (based on `feature/ai-first-foundation`).
**Original AI-first planning PR:** https://github.com/mrAibo/WEG_HomeManager/pull/1 — still open/DRAFT/unmerged at previous check.
**Upstream source:** `fgilde/hausverwaltung` main, SHA `cb130792cfe40444c35827d059900f3b552a9af4`.
**Identity:** independent repository, not a GitHub-native fork. HaVeWa imported with a merge that preserves history and AGPLv3 licensing.

## Done and verified
- [x] Remote Aibo came online and the repo was cloned into a dedicated Projects directory.
- [x] Added `upstream` Git remote; fetched exact HaVeWa main SHA.
- [x] Merged HaVeWa into separate integration branch; preserved own AI-first docs/prototype and upstream Git history.
- [x] Resolved one README conflict, retained WEG HomeManager README; original upstream English README copied to `docs/upstream/`; German README and licenses kept.
- [x] Archived upstream automatic publishing workflows in `docs/upstream/disabled-workflows/` to prevent inadvertent GHCR/Pages/Release publication.
- [x] `npm ci --no-audit --no-fund` installed 851 packages. npm 12 blocked 8 dependency lifecycle scripts; no blanket allow action.
- [x] `npx prisma generate` explicitly generated Prisma Client 6.19.3.
- [x] `npm test`: 39 Vitest files, 199 passed, 1 skipped (after separating Node prototype test).
- [x] `node --test prototype/ai-case/engine.test.mjs`: 8 passed, 0 failed.
- [x] `npm run build`: PASS on Next.js 16.2.10; warnings recorded in `docs/weg-homemanager/BASELINE_VERIFICATION.md`.
- [x] Added read-only integration GitHub Actions build/test workflow.
- [x] German-first, mobile-first AI/UX direction, dashboard design and MyHammer manual-assisted route remain agreed.

## Known failures, not hidden
- [ ] `npm run lint`: FAIL on imported HaVeWa source, **90 errors and 21 warnings**, mainly repeated `@next/next/no-html-link-for-pages` and React Hook purity/effect rules. Do not label lint green or suppress all rules; create scoped cleanup follow-up.
- [ ] PostgreSQL connection, migration application, running UI, end-to-end interaction not yet verified.
- [ ] HaVeWa authorization/MCP write methods, accounting and WEG voting legally/financially audited.
- [ ] Dashboard/PWA and AI-first integration implemented: **NOT YET**; existing upstream UI is not our approved redesign.
- [ ] OCR/vision, search providers, MyHammer API integration, real quotes, payment processing or autonomous emails implemented: **NOT YET**.
- [ ] Commercial licensing chosen or production rollout authorized.
- [ ] No actual personal WEG files, real photos/bank details or passwords in public repo.

## PR and branch tracking
- AI-first planning: PR #1 `feature/ai-first-foundation`, pending review, do not merge without checking.
- HaVeWa integration: branch `integration/havewa-baseline`; next coding agent should verify its latest commit and associated Draft PR on GitHub.
- G0/G1 issue #2: https://github.com/mrAibo/WEG_HomeManager/issues/2
- Dashboard issue #7: https://github.com/mrAibo/WEG_HomeManager/issues/7

## Immediate next action
1. Verify GitHub branch/CI/head before work; read `AGENTS.md`, `ROADMAP.md`, `HANDOFF.md`, `docs/weg-homemanager/BASELINE_VERIFICATION.md`.
2. Complete G0 security and lint triage. If lint fixes are too broad, keep clearly scoped technical debt.
3. Initialize **synthetic-only** Postgres and safe test users; run migrations and check the existing WebGUI. Do not use example demo credentials for a publicly reachable deployment.
4. Inventory existing HaVeWa auth/tickets/documents/dashboard modules; reuse these rather than rewriting.
5. Implement and test the first accessible, mobile-friendly Dashboard workflow: photo/problem → evidence-backed editable AI proposal → review/approval; no automatic external writes.
6. Update STATUS/HANDOFF and CI after each engineering change.

## Non-negotiables
Ponytail reuse-first, Lazy Admin, privacy/RBAC, idempotent human approvals, no fabricated contractor availability, no real WEG data in Git, no premature native app.
Some older chat attachments may expire; not needed for synthetic development. If truly necessary for authorized real-file work, request fresh upload.
