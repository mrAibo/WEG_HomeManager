# WEG HomeManager — STATUS (canonical, update after every engineering session)

**Verified as of:** 2026-10-22 (Europe/Berlin)
**Repository:** https://github.com/mrAibo/WEG_HomeManager
**Product:** AI-first, accessible German WEG management (professional / Selbstverwaltung modes)
**Primary UX choice:** responsive Next.js WebGUI, mobile-first, progressive-web-app option; no separate native application in MVP.
**Current stage:** **E0 — product architecture and safe prototype**. Production implementation has NOT started.

## GitHub truth
| Field | Current verified value |
|---|---|
| Repository | `mrAibo/WEG_HomeManager` (public) |
| Is GitHub fork of HaVeWa? | **No** (independent repository created by user) |
| Main | Initial README only; initial main SHA `d389bddd86ef1566cf62d0c4595bb99d9b151e58` at last verification |
| Working branch | `feature/ai-first-foundation` |
| Pull request | [#1](https://github.com/mrAibo/WEG_HomeManager/pull/1), **DRAFT / OPEN / UNMERGED** |
| Base app imported? | **No**: no HaVeWa source code, database schema or production UI in this repo |
| Prototype | `prototype/ai-case/engine.mjs` in working branch only |
| CI check | [GitHub Actions run 39757712537](https://github.com/mrAibo/WEG_HomeManager/actions/runs/39757712537) **success**, 8 Node tests (at previous code revision) |
| External integrations | No OCR/LLM, bank, contractor search, MyHammer or email execution implemented |
| Synthetic vs real data | Prototype is synthetic-only; no real personal WEG records committed |

**Important:** After any new commits, re-check PR head SHA and CI before asserting tests pass for that revision. Documentation-only commits do not establish code coverage.

## Verified completed [x]
- [x] Connected GitHub access verified for `mrAibo`.
- [x] Existing upstream HaVeWa architecture and AGPLv3/commercial licensing inspected at repository documentation/code level.
- [x] Draft PR #1 established with original product docs and controlled synthetic workflow prototype.
- [x] Prototype can create evidence-linked cases, make drafts, permit manual revision, invalidate approvals after edits, require manager review and block direct bank-transfer proposals.
- [x] Eight prototype tests passed in GitHub Actions; no provider side effects.
- [x] Product decision: **AI-first, Lazy Admin, human-in-the-loop**.
- [x] Product decision: **reuse HaVeWa**; no rewrite, no unnecessary new framework.
- [x] UX direction defined: responsive web-first Dashboard / PWA (see `docs/weg-homemanager/UX_DASHBOARD.md`).
- [x] MyHammer initial feasibility and usage limitations researched (see `docs/weg-homemanager/CONTRACTOR_MARKETPLACES.md`).
- [x] Portable Ponytail-inspired rules documented in `AGENTS.md`.
- [x] Canonical status, roadmap and handoff files prepared on working branch.

## NOT completed [ ]
- [ ] **E1/G0** Import upstream HaVeWa into repo with attribution and upstream sync.
- [ ] Full baseline build, test/lint run and accounting/security audit of imported source.
- [ ] Actual Dashboard/PWA, design system or user tests.
- [ ] Production persisted Case/Evidence/Proposal/Approval models, secure RBAC and source storage.
- [ ] Photo OCR/vision, AI model integration, contractor discovery, external marketplace API.
- [ ] Email send, live bids, orders, invoice booking and bank transactions.
- [ ] Verified German WEG compliance or permission to administer actual property.
- [ ] Production deployment or actual personal data use.

## Active issues
- [#2](https://github.com/mrAibo/WEG_HomeManager/issues/2) Upstream baseline import, audit and tests — **highest next engineering priority**
- [#3](https://github.com/mrAibo/WEG_HomeManager/issues/3) Persisted case orchestration and human approvals
- [#4](https://github.com/mrAibo/WEG_HomeManager/issues/4) Photo/scan intake
- [#5](https://github.com/mrAibo/WEG_HomeManager/issues/5) Handwerker research, quotes
- [#6](https://github.com/mrAibo/WEG_HomeManager/issues/6) Invoice accounting assistant
- [#7](https://github.com/mrAibo/WEG_HomeManager/issues/7) Novice-first Dashboard, responsive WebGUI and usability testing
- [#8](https://github.com/mrAibo/WEG_HomeManager/issues/8) MyHammer assisted handoff and quote comparison

## Immediate next step
1. Inspect repo and PR #1 again to detect new work; keep Draft status until review.
2. Integrate HaVeWa upstream **in a separate reviewable branch/PR**, without force push and without replacing this documentation.
3. Verify `npm install`, `npm test`, `npm run lint`, `npm run build` against pinned revision and establish reproducible demo data.
4. Inventory and re-use existing HaVeWa screen components, dashboard, authentication, tickets, documents and MCP.
5. Build the **first usability-tested vertical slice**: upload photo -> AI-assisted maintenance case proposal -> human edit/review -> approved draft inquiry, with no external send until authorized.
6. Update this file with exact SHA, tests and blockers.

## Known blockers/decisions
- GitHub repo is independent rather than a fork. Use documented controlled import (see `UPSTREAM_INTEGRATION.md`).
- Upstream license: AGPLv3 unless a separate commercial license is obtained; decide product distribution before commercializing.
- MyHammer public posting API was not verified and its AGB constrain automated scraping. Use **assisted manual handoff** first, not scraping.
- Do not treat an AI recommendation as authority to bind the WEG, authorize expenditure or conclude a contractor agreement.
- **Private documents from other conversations are not necessary for synthetic development.** Some older file attachments may expire; request re-upload only when they become essential for authorized analysis.

## Update discipline
Every agent must change the date, branch/head SHA, tests actually executed, acceptance gates and unresolved issues when its work changes status. Never mark an untested feature as completed.
