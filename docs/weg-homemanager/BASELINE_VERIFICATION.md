# HaVeWa upstream baseline verification — 2026-10-22

**Status:** imported and tested **locally**, pending review/CI in GitHub. No live production deployment.

## Provenance
- WEG HomeManager: `mrAibo/WEG_HomeManager`
- Intended base: `fgilde/hausverwaltung`
- Verified upstream main commit: `cb130792cfe40444c35827d059900f3b552a9af4`
- Working integration branch: `integration/havewa-baseline`, based on `origin/feature/ai-first-foundation`
- Git integration strategy: merge two unrelated histories to preserve the HaVeWa commit lineage, our AI-first docs, and baseline tests. Do not force-push main.
- Single merge conflict: `README.md`; kept WEG HomeManager's README and saved original HaVeWa README in `docs/upstream/README-HaVeWa-original.md`. Upstream `README.de.md` remains intact.
- Legal: upstream `LICENSE` (AGPLv3), `LICENSING.md` and bundled font/asset notices retained. No private WEG data or secrets committed.
- Upstream workflows that *publish* GHCR packages, Pages and CasaOS releases are archived under `docs/upstream/disabled-workflows/` to avoid accidentally releasing products after merge.

## Device / reproducibility
- Remote Windows computer: Aibo
- Working tree: `C:\Users\crown\Downloads\Projects\WEG_HomeManager`
- Git 2.51.0.windows.2, Node v24.19.0, npm 12.2.0
- `npm ci --no-audit --no-fund`: PASS; 851 packages. npm 12 blocked eight dependency lifecycle install scripts by default; no blanket allowlisting was applied.
- `npx prisma generate`: PASS; generated Prisma Client v6.19.3 manually.
- `npm test`: PASS after excluding the standalone `prototype/**` Node test suite from Vitest.
  - Upstream Vitest: 39 test files passed, 199 tests passed, 1 skipped.
  - AI case prototype: `node --test prototype/ai-case/engine.test.mjs` 8/8 passed.
- `npm run build`: PASS with Next.js 16.2.10. Warnings: deprecated middleware convention and Turbopack trace of dynamic filesystem path in PDF/A route.
- `npm run lint`: FAIL on baseline; 90 errors and 21 warnings. Many duplicate errors from `@next/next/no-html-link-for-pages` on direct `/api/export/` links, plus React hook purity/effect warnings/errors. They were present in imported HaVeWa code. Do not claim the project is lint-clean, blindly disable all rules, or rewrite unrelated components without scoped review.
- Database development smoke test: **PASS**. Started fresh PostgreSQL 16 container `havewa-db` with its port limited to `127.0.0.1:5432`, generated a private random `AUTH_SECRET` in ignored `.env`, and applied all **62 Prisma migrations** (`npx prisma migrate deploy` success).
- Local Next.js startup: **PASS**. `npm run start -- -H 127.0.0.1 -p 3000` returned Ready; GET `/` and `/setup` returned 200; initial wizard located at `/de/setup`.
- GitHub Actions Linux: **PASS**, run [39765475490](https://github.com/mrAibo/WEG_HomeManager/actions/runs/39765475490) at initial integration SHA `e44763ace62fefd992f5267f48f321353847bc06`.
- Full end-to-end click tests, administrator creation, backup restore, auth/security review and real-world accounting audit: **NOT RUN**. PostgreSQL example user/password are suitable only for a loopback-bound synthetic development database, not production.

## Integration change list
1. Import HaVeWa full code and Git history by explicit merge.
2. Keep WEG HomeManager README, existing AI case prototype, AGENTS/STATUS/ROADMAP/HANDOFF and docs.
3. Save the upstream English README copy under `docs/upstream/`.
4. Correct `vitest.config.ts` to exclude Node's standalone `prototype/**` suite while retaining Vitest default exclusions.
5. Archive upstream external publishing workflows to ensure safe CI on this repository.
6. Add a dedicated read-only CI workflow that checks Prisma generation, both test suites and Next.js build on integration PRs.

## Open gates
- [ ] Full security/role and MCP write-tool audit; AI must not use inherited broad write operations without approval and server-side RBAC.
- [ ] Review and repair inherited lint failures in a separate scoped issue/PR; distinguish correct export anchors from actual client-side navigation problems.
- [ ] Confirm npm 12 lifecycle-script policy and reproducible Linux CI; no unreviewed postinstall blanket permissions.
- [x] PostgreSQL container and schema migration (62) successful, Next.js server HTTP smoke 200 OK.
- [ ] Finish safe synthetic demo onboarding and perform real UI clickthrough / authorization verification.
- [ ] Audit accounting against fixed WEG scenarios and source documents before production.
- [ ] Decide AGPLv3 versus a separate HaVeWa commercial license before commercializing.
- [ ] Do not merge integration PR while production correctness remains unverified; keep as DRAFT.
