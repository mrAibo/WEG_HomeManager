# WEG HomeManager — handoff for the next coding agent

**Date:** 2026-10-22. **Repo:** https://github.com/mrAibo/WEG_HomeManager.
**Canonical files:** `STATUS.md`, `ROADMAP.md`, `AGENTS.md`.
**Current branch:** `feature/ai-first-foundation`.
**Current PR:** [#1](https://github.com/mrAibo/WEG_HomeManager/pull/1) open/DRAFT/unmerged into `main`. Check exact head SHA at start: it can change.

## Nonnegotiable user decisions
- Product is **AI-first**: upload scans/photos, ask natural-language questions, AI proposes the work, locates providers, drafts documents; user can always manually revise.
- UX must be **extremely user friendly** for people without IT or WEG expertise: guided Dashboard, German-first, accessible, no complex forms.
- **WebGUI / responsive PWA** before any native app; leverage existing Next.js upstream stack.
- **Ponytail Lazy Admin**: eliminate unnecessary admin work, reuse code before writing new, YAGNI, stdlib/native browser/installed dependencies before new abstractions.
- Start with fictional/synthetic properties; do not publish real owner data or personal WEG documents.
- Human authorization for email, orders, invoices/bank actions and legally binding decisions.

## Verified state
- User-created repository is public and independent, **not** an actual GitHub fork of HaVeWa.
- Original main only had the initial README at `d389bddd86ef1566cf62d0c4595bb99d9b151e58` as last checked.
- PR #1 includes an original in-memory Node prototype and project docs; prior GitHub CI test run passed 8 Node tests (https://github.com/mrAibo/WEG_HomeManager/actions/runs/39757712537).
- This session added canonical project/status/UX/vendor/reuse documents and agent instructions to same draft PR branch (inspect changed files).
- **Not done:** HaVeWa source import, real UI, operational AI, OCR, vendor search or integration, accounting/legal validation, deployment.
- Existing development issues [#2](https://github.com/mrAibo/WEG_HomeManager/issues/2)–[#6](https://github.com/mrAibo/WEG_HomeManager/issues/6) cover upstream, case workflows, scans, vendors and accounting.

## How to continue (do not ask user to repeat decisions)
1. `git fetch origin`; inspect `main`, `feature/ai-first-foundation`, PR #1 and newer commits. Do NOT assume old SHA is latest.
2. Read `AGENTS.md`, `STATUS.md`, `ROADMAP.md`, `docs/weg-homemanager/UX_DASHBOARD.md`, `docs/weg-homemanager/CONTRACTOR_MARKETPLACES.md`, `docs/weg-homemanager/UPSTREAM_INTEGRATION.md`.
3. Run `node --test prototype/ai-case/engine.test.mjs` and `node prototype/ai-case/demo.mjs`; record real output.
4. Prioritize **Issue #2**: integrate `fgilde/hausverwaltung` source into an isolated branch; preserve license and history/provenance. Upstream is AGPLv3 (commercial alternative).
5. Audit existing HaVeWa modules first: AI text adapter, MCP route (read+write!), tickets, document uploads, auth, dashboard and finance. Choose adaptation over duplication.
6. After baseline works, prototype a single user-visible Dashboard journey **photo → maintenance case → AI editable inquiry → human approval**. Never auto-send during the first slice.
7. Keep project status truthful; update files, PR, CI and issue links at handoff.

## UX decisions and copy
Top prompt: **"Was kann ich für Sie erledigen?"**.
Main actions: **Foto aufnehmen**, **Dokument hochladen**, **Frage stellen**.
Dashboard sections: **Jetzt wichtig**, **Zur Freigabe**, **In Bearbeitung**, **Finanzen**, **Termine**.
Use reassuring, plain-language details: who handles it, what data is used, what the user can still change; show exactly when an outgoing action occurs.

## MyHammer integration policy
Verified official URL: https://www.my-hammer.de/auftraggeber-info/so-funktionierts
Employer/customer posting free according to MyHammer, but contractor response not guaranteed. The platform matches leads and bids; it is not a real-time live auction.
Published AGB Feb 2026: user may not publish third-party jobs, duplicate the same job, or scrape data; contractor qualifications and proposals must be checked.
No approved public job-posting API was verified. Build a **manual assisted handoff** (editable ad, copy, official page open, owner posts, import user-provided quote), **not a bot**. Provider partnership/integration only with explicit approval.

## Unresolved decisions
- AGPLv3/open vs HaVeWa commercial proprietary license (do not assume proprietary use permitted).
- Product naming, branding, whether public SaaS business is intended; these need not block synthetic MVP.
- Real banking, email, local-service integrations and domain hosting — no external action without explicit permission.
- The expired attachments from previous chats are not required for synthetic development.

## Stop conditions
If an agent cannot create the code integration in its tool environment, preserve the repo and write an exact blocker in STATUS.md; do not claim the upstream was imported.
Do not merge Draft PR #1 until reviewed.
