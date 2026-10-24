# WEG HomeManager — Codex Handoff
**Prepared:** 2026-10-24
**Primary language:** German UI; communicate with project owner in Russian.
**Repository:** https://github.com/mrAibo/WEG_HomeManager
**Active branch:** `feature/e10-ai-document-triage`
**Verified E10 source HEAD before this handoff:** `5c32d32f3716992ce39cfe969799686d1b8f7a04`
**Active review:** [Draft PR #26](https://github.com/mrAibo/WEG_HomeManager/pull/26), base `feature/e9-guided-workflow-meetings` (PR #25)
**Source commit CI:** [GitHub Actions run 39927509421](https://github.com/mrAibo/WEG_HomeManager/actions/runs/39927509421) — SUCCESS.
**Local Windows checkout:** `C:\Users\crown\Downloads\Projects\WEG_HomeManager` on computer **Aibo**.

## 0 — INSTRUCTIONS TO CODEX: START HERE

Continue engineering the **existing** WEG HomeManager application, not a rewrite or a new repository. Do not ask the user to re-explain the project.

1. Read **`AGENTS.md`, `STATUS.md`, `ROADMAP.md`, `HANDOFF.md`** and the appropriate `docs/weg-homemanager/*.md` before coding. This Codex handoff is supplementary to those canonical files.
2. Verify Git reality first: `git status --short --branch`, `git log -5 --oneline`, `git remote -v`, `git fetch origin`, current PR #26 and its CI. Do not assume all historical notes are current.
3. If Codex has the GitHub repo but **not the Aibo desktop filesystem**, do **not** assume local `.env`, databases, or browser fixtures are available. Run isolated checks, and request access only if essential. Never infer a real DB from a `DATABASE_URL` string in a template.
4. Stay on the current feature/review branch or create **one new stacked Draft PR based on #26** for a new milestone. Never merge any Draft PR or push to `main` without explicit user permission.
5. **NEVER use `git add .` in the Windows checkout.** There are two untracked PRIVATE files, `Aufteilungsplan.PDF` and `Teilungserklärung.PDF`, which must stay uncommitted, unuploaded and excluded from external-model tests. Stage named files only. Also avoid `.env`, secrets, storage, backups and local credential JSON.
6. Work autonomously within the safety gates, verify with relevant tests and genuine synthetic-only DB/Chrome smokes, and finish each increment with updated `STATUS.md`, `ROADMAP.md`, `HANDOFF.md`, a **Draft PR**, commit SHA and CI result. Never claim a result that has not been observed.

## 1 — USER VISION AND PRODUCT DECISIONS (DO NOT RE-ASK)

- The product is **WEG HomeManager**: an **AI-first, human-controlled, very easy-to-use German property and Wohnungseigentümergemeinschaft (WEG) management web app** for nontechnical people ("Lazy Admin"). This is based on the existing **HaVeWa** codebase.
- Core user journey: **open app → upload PDF/photo, forward email or type question → system stores original → selected AI analyzes document, recognizes what it is, extracts source-backed information and suggests what to do → person reviews/corrects → person explicitly authorizes consequential action**.
- The user dislikes a screen full of controls; optimize simple German next-step explanations, gentle visual design, focused "what now" cards, contextual help on every module, and sensible progressive disclosure. Keep accessibility and phone-width layout.
- AI provider **and model are chosen by the tenant administrator** in existing `Einstellungen → Integrationen → KI`. No forced Astra, default heavyweight model or compulsory local OCR engine. Currently supported protocols are Anthropic Messages PDF/images, OpenAI-compatible Chat images and OpenAI Responses PDF; **not every provider/model supports vision/PDF**.
- AI must not be able to autonomously send messages, hire contractors, create orders, approve legal matters, book invoices or pay money. Use exact-version **COPY_ONLY** human approvals and deterministic, server-enforced business checks.
- User wants Gmail address **`crownru+weg@gmail.com` for BOTH incoming and outgoing mail**, with administrator review of prepared replies before send. This is a **plus alias of `crownru@gmail.com`, not a standalone Gmail account**. Filter to a `WEG-HomeManager` label; never read full personal INBOX. Gmail send-as must be configured/verified at Gmail; no real connection yet.
- User may ultimately run app on a **single Windows PC without Docker**. Node/Next.js and Prisma work natively; PostgreSQL is currently a Docker localhost test container and could be replaced by a properly installed native Windows PostgreSQL service. Existing launcher is not a full installer.
- For owner meetings, provide invitation-document preparation, economic plan/financial attachments, agenda and resolutions. Owners **and residents** can submit suggestions/requests, but managers decide whether to put these on the agenda. Follow legal requirements and human review; do not assume a UI role alone constitutes legal authorization.
- The user's PC already has antivirus; do not install a second scanner automatically. Verification of actual Evidence directory coverage, PDF parser OS isolation, permissions and GDPR processing remain gates before real uploads.

## 2 — WHAT EXISTS IN THE REPOSITORY

### Architecture / origins
- Upstream: `fgilde/hausverwaltung` (HaVeWa), preserved source history and **AGPLv3**, originally imported at `cb130792cfe40444c35827d059900f3b552a9af4`. WEG HomeManager is an independent repo, not a GitHub-native fork. Preserve upstream copyright/attribution and licenses.
- Next.js **16.2.10** App Router, TypeScript, React, Tailwind/shadcn UI, Auth.js, Prisma **6.19.3** and PostgreSQL **16** in local demo. Existing upstream has extensive `Document`, `Meeting`, `AgendaItem`, `Unit`, `Owner`, `Renter`, accounting and communications modules; **reuse before creating parallel systems**. Use existing installed OpenAI/Anthropic SDKs and the Node/browser stack.
- Main screens: Dashboard `src/app/[locale]/(admin)/dashboard/page.tsx`, saved Cases `src/app/[locale]/(admin)/cases/`, meetings `src/app/[locale]/(admin)/meetings/`, resident/owner portal `src/app/[locale]/portal/page.tsx`.
- **68** Prisma migrations exist and were applied to the **strictly synthetic localhost** DB. Migrations 63–68 add `AiCase`, `AiProposal`, `AiApproval`, `AiCaseEvent`, `AiEvidence`, immutable hashes/snapshots, `AiRecognition`, meeting suggestions and E10 triage JSON.
- Saved originals are local files under the storage abstraction, bound to tenant/Case hashes and protected downloads. The browser file picker only selects: `Dokument jetzt ablegen` actually creates a Case plus uploads Evidence with clear success/error messaging; recent Cases and sidebar offer re-entry after navigation.

### E7/E10 — user-selected document understanding (latest)
- `src/lib/ai-document-recognition.ts`: **one** model request for OCR + triage when model supports it. No required extra OCR project; does not silently swap the selected model.
- `src/lib/ai-document-triage.ts`: strict Zod **allowed document types/actions**; data such as possible sender, WEG, date, due date, facts require source-text quotes; unknown command/action codes or ungrounded quotes rejected. Confidence is self-reported, **NOT calibrated**; source quote is from the *model-produced transcription*, so it is NOT proof the scan was read correctly.
- `src/server/ai-recognition-workflow.ts`: session-derived actor/tenant, permission + explicit per-file consent, SHA check before/after inference, DRAFT lock, one recognition per Evidence, guarded storage of `AiRecognition.triage` JSON and OCR, separate human correction/audit. No automatic effects.
- `src/components/case-recognition.tsx` and `src/app/[locale]/(admin)/cases/[id]/page.tsx`: German “Dokument mit KI analysieren” button, untrusted `KI-Einschätzung` card, facts with quotes, fixed navigational safe-next-step links and editable human-checked transcription. Old OCR-only records with null triage still display.
- **E10 has been committed and pushed** as Draft PR #26, SHA above, Linux CI SUCCESS. Local synthetic DB smoke, authenticated Chrome with only a loopback fake provider, **337 PASS / 1 SKIP** Vitest, TypeScript/scoped ESLint and production Next build were recorded in `STATUS.md`. **No real provider OCR was run; no true accuracy benchmark**.

### E8/E9 — UX, Gmail and meetings
- E9 redesigned teal/navy welcome page, three starter tasks, collapsible expert KPIs/AI Assistant, module-specific guides in `src/lib/module-help.ts` and `src/components/module-guide.tsx`, saved Case list and durable file intake. Draft PR #25.
- E9 `MeetingSuggestion` model and `src/server/actions/meeting-suggestions.ts`: tenant/property-linked `EIGENTUEMER` or `MIETER` users send topics to planned meeting; manager explicitly promotes to `AgendaItem` TOP or marks reviewed/not included. Meeting preparation checklist currently **UI-only/not persistent**; invitation packet and tested distribution are NOT implemented.
- E9 opted-in demonstration fixture: one fictitious **six-unit WEG with 1000/1000 MEA**, one future meeting, 3 sample TOPs, 2 owner/resident suggestions, 2 generated PDFs, separate synthetic owner/resident portal logins. `scripts/e9-seed-guided-demo.ts` has strong local-only guard and is idempotent. Real user's original PDF files were never used.
- E8 rebranded product; HaVeWa AGPL attribution remains. `src/lib/mailbox-safety.ts` blocks Gmail full INBOX/All Mail selection in existing IMAP, provides matching plus-alias sender check; `src/server/actions/email.ts` requires human checkbox before new email can queue. Inherited **other/bulk email send paths still need security review**; no Gmail OAuth/real mail account wired. Draft PR #24.
- E8 Windows double-click `start-weg-homemanager.cmd` runs `scripts/start-weg-local.ps1`; it requires an **existing** PostgreSQL server on localhost port 5432 and a Next.js production build, does not provision DB or change Windows services.

## 3 — LOCAL ENVIRONMENT AND TESTS

On **Aibo** at `C:\Users\crown\Downloads\Projects\WEG_HomeManager`:
- Docker Desktop container `havewa-db` (PostgreSQL 16), mapped **127.0.0.1:5432** for **synthetic-only** tenant **`WEG Demo – Sechs Wohnungen`**; all users have `.invalid` domains. This is NOT a production database; demo password/security gates fail.
- Windows Next.js production app was checked on **2026-10-24** at `http://127.0.0.1:3000/de/login` and returned **HTTP 200**. A local host inside a Codex cloud sandbox is **not** this machine; a browser there will not reach the Aibo loopback address.
- Local private ignored `.env`; never display `DATABASE_URL`, `AUTH_SECRET`, provider keys or print the credentials.
- Synthetic admin: `qa-admin@weg-home-manager.invalid`; password in the **sibling directory outside repo** `..\WEG_HomeManager_LOCAL_TEST_CREDENTIALS.json`. Owner/resident portal QA passwords in `..\WEG_HomeManager_LOCAL_PORTAL_TEST_CREDENTIALS.json`. Codex must not commit, share or reveal their contents.
- Two **untracked real/private files in repo root**: `Aufteilungsplan.PDF` and `Teilungserklärung.PDF`. **DO NOT OPEN unless the owner explicitly requests analysis; DO NOT upload to a model, seed, commit, share or include in CI**.
- **Never touch other Aibo Docker containers or unrelated applications.**
- Test after changes, recording actual observations:
```powershell
git status --short --branch
npx prisma validate
npx tsc --noEmit
npm test
node --test prototype/ai-case/engine.test.mjs
npm run build
node scripts/e6-worker-package-smoke.mjs
```
- Existing global `npm run lint` has inherited upstream violations; use targeted ESLint for changed files, and fix new errors. Do not suppress entire lint rules.
- Scripts requiring **strict synthetic localhost tenant guard**: `scripts/e7-recognition-db-smoke.ts` and `scripts/e7-recognition-ui-smoke.mjs` (local mock model/Chrome). `scripts/e9-guided-ui-smoke.mjs` checks document persistence and review of a submitted meeting suggestion. Do not run against real accounts/DBs. Browser smokes also need ignored local test credential variables.
- Check app start only if not already on port 3000. When rebuilding on Windows, stop only the **identified Next.js process**, not any other service, then restart `npm run start -- -H 127.0.0.1 -p 3000`.
- **Do not run `prisma migrate reset` or `db:reset`**, no unconditional seeding, no blanket delete/cleanup; migrations to real DBs require separate approval + backup.

## 4 — NON-NEGOTIABLE SECURITY LIMITS

1. **AI results are untrusted advice**. Documents, OCR, emails and websites contain possible prompt injections; never let their content invoke privileged actions.
2. MCP has a **read-only tool allowlist**. Generic upstream REST `/api/v1/**` Bearer writes have been blocked with route-level 403; **read-token purpose/scope, other privileged routes, per-object authorization and Issue #11 remain open**. Never grant an LLM admin/session tokens or add general-purpose write tools.
3. Model cannot commit a payment, vendor decision, invoice booking, legal resolution, email, agenda item, user change or property assignment. Human review, deterministic rules and durable exact-version approvals are required. The OCR “human reviewed” flag is **not legal/business approval**.
4. PDF/JPEG/PNG upload validation, a child-process PDF inspection worker, SHA-256 originals, protected downloads and synthetic backup/restore exist. **This is not a complete malware scanner nor a full OS sandbox**: confirm Windows host antivirus actually covers the Evidence directory; no-egress OS restrictions on PDF worker and resource limits remain open. No second ClamAV requested for current single-PC plan.
5. No real WEG document, personal email, actual owner data, bank details or Gmail/provider credentials should enter the demo DB or external AI. Real deployment needs fresh credentials, dedicated low-privilege service, NTFS ACLs, GDPR basis/retention, audited authentication, backups+restore and legal/accounting review.
6. **No automatic outgoing Gmail**; do not test live `crownru+weg@gmail.com` without explicit consent and secure OAuth/send-as verification. SMTP IMAP credentials remain broader than a Gmail label.

## 5 — NEXT WORK: RECOMMENDED E11, ONE FOCUSED DRAFT PR

**User-value problem:** E10 recognizes and recommends, but it does **not yet let the user approve the proposed classification, assign the correct WEG/property or file the document into the existing Document archive**. This is the next natural vertical slice, not more arbitrary AI tools.

Propose and implement, under the existing human-approval/security model:
1. On a saved Case show the source document + untrusted AI `category`, source-linked metadata, possible WEG, due date and recommended workflow. Clear error/uncertainty signs.
2. Offer human-editable **“Dokument zuordnen”** flow using the real tenant-scoped list of Properties and a bounded category enum. **Do not trust `propertyHint` as an ID**: it is free-text AI speculation and must never auto-bind a Property.
3. Persist an immutable record of the person's selected classification and object assignment **separate from the AI raw suggestion**, with actor identity/time, original SHA-256, and idempotency/version rules; recheck file hash/object entitlement on server. Prefer extending existing `AiRecognition`/Case and upstream `Document` rather than duplicating an archive.
4. Only after explicit confirmation, promote the original file or link safely to the existing `Document` archive, selecting correct tenancy, provenance, retention, access rights and backup behavior. Do not break old Case links, create duplicate file references or silently change previously approved cases.
5. No automatic mail, payment, booking, agenda approval or meeting invitation. A link to next section means navigation only. Include tests for wrong tenant, stale SHA, duplicate submission, unauthenticated user and forbidden owner role.
6. Verify with synthetic PDF and real browser navigation; preserve the six-unit demo and all prior tests. Update canonical docs; create E11 **stacked Draft PR with base `feature/e10-ai-document-triage`**, never merge main.

**Follow-up milestones AFTER E11:** legally reviewed individualized invitation packets for WEG assemblies; owner/resident request inbox with admin queue; durable meeting prep checklists; optional Gmail read/send OAuth and explicit queue; native Windows installer/Postgres service; benchmarks of chosen models with authorized anonymized low-quality handwriting/scans; production hardening and GDPR.

## 6 — GIT / PR CHAIN / HANDOFF OUTPUT

Most recent:
- **PR #26** E10 AI classify/next steps — https://github.com/mrAibo/WEG_HomeManager/pull/26 — **Draft**, base E9 branch.
- **PR #25** E9 guided first-run/meetings — https://github.com/mrAibo/WEG_HomeManager/pull/25 — **Draft**, base E8.
- **PR #24** E8 identity, Gmail policies and Windows launcher — https://github.com/mrAibo/WEG_HomeManager/pull/24 — **Draft**, base E7.
- **PR #23** E7 user-selected OCR — https://github.com/mrAibo/WEG_HomeManager/pull/23 — **Draft**.
- **PR #22** E6 single-PC preflight, previous E5/E4/E3/E2/E1 stacked review branches; upstream and AGPL source history preserved.
- See GitHub for current PR statuses; statuses can change after this handoff. Do not squash/merge the chain without a conscious integration plan.

**Required final output from Codex on each new milestone:** implemented change, specific code paths, synthetic tests with actual results, GitHub Draft PR link and SHA/CI status, human-visible behavior and remaining blockers; no background promises.

**First Codex action (suggested):**
```text
Read AGENTS.md, CODEX_HANDOFF_2026-10-24.md, STATUS.md, HANDOFF.md, ROADMAP.md
and docs/weg-homemanager/AI_DOCUMENT_TRIAGE.md. Inspect active
feature/e10-ai-document-triage, Draft PR #26 and live files before editing.
Do not merge into main or commit the private untracked PDF files.
Prepare the smallest safe E11 human-reviewed Document classification / WEG
assignment / archive handoff design, implement a vertical slice with
synthetic-only security and Chrome tests, and open a stacked Draft PR.
```
