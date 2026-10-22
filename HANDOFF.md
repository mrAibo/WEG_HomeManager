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
- No running database, legal/accounting validation or real app clickthrough yet. Full test detail in `docs/weg-homemanager/BASELINE_VERIFICATION.md`.

## Required first actions
1. `git status --short --branch` and `git fetch origin upstream`, inspect any commits newer than this handoff; never overwrite newer work.
2. Inspect current PR #1 and a separate integration Draft PR (check GitHub; do not assume merged).
3. Read canonical files and licenses. Record exact current HEAD in STATUS when moving branches.
4. Evaluate security of existing HaVeWa `src/app/api/mcp/route.ts`, `src/lib/api-auth.ts`, server actions, tenant scope and uploads BEFORE enabling model write tools.
5. Review inherited lint failures; fix only with scoped changes and tests. Check CI Linux npm 12 script blocking/Prisma generation.
6. Setup synthetic Postgres and call the existing UI; identify what truly needs changing.
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
