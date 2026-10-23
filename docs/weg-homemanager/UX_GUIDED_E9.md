# E9 — Guided WEG UX, durable file intake and meeting requests

**2026-10-23 — synthetic-only pilot, Draft PR stacked on E8 #24. Not production-ready.**

## Why a selected document disappeared
Before E9 the Dashboard `Dokument auswählen` picker only retained the browser's transient `File` object. It did **not** upload unless the user wrote a description, generated a rule-based proposal, checked review, then clicked `Vorgang speichern`. Navigation discarded the local selection.

Now the selected PDF/JPG/PNG gets a clear `Dokument jetzt ablegen` button. It explicitly creates a persisted **AiCase**, uploads original Evidence under tenant-scoped SHA-256 validation, then displays a durable Case link; failure to save binary is differentiated from the creation of the Case. No AI API call, email, ticket or financial action occurs on this step. Selected files without a save click still only exist locally in the browser; automatic transmission is intentionally avoided. The Dashboard shows four recent Cases and counts saved files; `Gespeicherte Vorgänge` is also a sidebar entry with attachment counts. Original SHA-256 and bytes remain downloadable from each authenticated Case.

**Verified actual Chrome test**: generated local synthetic PDF picked and saved with **no description** using the new quick button, navigated through Meetings and Cases, opened persisted PDF in Case; `E9_FILE_PERSISTENCE_PASS`. Temporary Case and original binary removed after smoke.

## Progressive interface
- A branded teal/navy welcome hero asks the first question; three task cards lead to **Immobilie → Dokumente → Eigentümerversammlung**.
- Recent Cases appear before any financial charts. Advanced KPIs/graphs and AI Assistant are optional collapsible panels rather than the main first-run experience.
- Every module in the sidebar has a short purpose and concrete first action, displayed in a `ModuleGuide` help panel on the matching page. Two seldom-used navigation groups are collapsed until needed. User can still reach all inherited HaVeWa modules.
- Accessible labels, semantic links, live `role=status` upload confirmation, strong link to saved Case, better colors/spacing/mobile grid. Layout is a **functional redesign**, not just a mockup.
- New help coverage unit tests verify that every module in `navGroups` has a description and that dynamic routes work.

## WEG meeting preparation & owner/resident contributions
- Planned Meeting page adds an 8-item preparation checklist: contacts/ownership, economic plan, reserve, offers/invoices, resident proposals, agenda and resolution wording, invitation deadlines, proxies and minutes. **Checklist checkboxes are local UI-only, not yet persisted or legally binding**.
- An authenticated `EIGENTUEMER` or `MIETER` can submit a title + explanation from `/portal` to an **upcoming `GEPLANT` meeting** of a property their own `Person` is linked to (via `Owner` or `Renter` → Unit → Building → Property). Role, tenant, person-object relationship, planned state and form length are validated **server-side**.
- New `MeetingSuggestion` table (67th additive Prisma migration) stores original text, actor ID/role, meeting, NEW status, reviewer and optional AgendaItemId.
- Managers/ADMIN review the suggestion; `ADD` atomically creates a new AgendaItem TOP and stamps reviewer, `NOT_ON_AGENDA` records that it was considered without adding to agenda. Nobody can get an automatic legally binding decision from a submission. AI cannot send invitations or add agenda automatically.
- The user's portal displays their own submissions/status only, not others'. The manager sees a review queue on the Meeting detail page and can choose actions. A human-prepared invitation packet with individualized recipient attachments, durable checklist completion and legally valid dispatch is a **future** feature.
- Actual Chrome smoke: logged in as synthetic owner, submitted proposed Fahrradstellplätze topic, logged in as synthetic admin, added topic to agenda; server confirmed status and AgendaItem, then removed smoke fixtures. `E9_SUGGESTION_REVIEW_PASS`.

## Synthetic onboarding data (already placed in Aibo test database)
- A purely fictitious WEG `WEG Musterhaus – sechs Wohnungen [SYNTHETISCH]` in `Musterstadt`, 6 apartments, 1000/1000 MEA; no real addresses.
- Two portal test accounts for EIGENTUEMER and MIETER, linked to a unit/contract in this WEG; credentials held exclusively in `../WEG_HomeManager_LOCAL_PORTAL_TEST_CREDENTIALS.json` **outside Git**.
- Planned 19 November 2026 meeting, 3 starter agenda items and 2 NEW suggestions (one owner, one tenant); 2 locally generated PDF attachments in saved Cases, including a sample invitation draft and economic-plan note, visibly stamped SYNTHETISCH.
- `scripts/e9-seed-guided-demo.ts` is opt-in and includes strict guard: only `localhost:5432/havewa`, exactly the sole named six-apartment demo tenant, all user addresses `.invalid`, and current admin account. It creates records once and is idempotent for the named property. It neither resets nor imports original user PDFs, sends mail, touches credentials or any other Docker app.
- Real `Aufteilungsplan.PDF` and `Teilungserklärung.PDF` in the repo working directory remain private **untracked files**, never staged or used.

## How to log in
- **Existing synthetic admin**: `qa-admin@weg-home-manager.invalid` with the earlier supplied *locally stored test password* from `../WEG_HomeManager_LOCAL_TEST_CREDENTIALS.json`. ADMIN is already a full tenant administrator in this test environment.
- To add an **own account** in the future, sign in as admin → `Einstellungen → Benutzer → Benutzer hinzufügen`, then choose ADMIN/VERWALTER as appropriate and set an independently strong password. Registration via regular Gmail sign-in does not exist; personal Gmail address is not an identity provider automatically.
- **Do not put personal email, actual property documents or other personal information into the current synthetic-only database.** Real onboarding first requires proper production database credentials/role segregation and security review.
- The sample portal test accounts are `qa-owner@weg-home-manager.invalid` and `qa-bewohner@weg-home-manager.invalid` with passwords in the separate local demo JSON, not committed.

## Tests and caveats
- 67 Prisma migrations current on synthetic Postgres. Playwright Chrome authenticated persistence and two-role submission/review checks PASS, tested against `http://127.0.0.1:3000`.
- `npm test`, `npx tsc --noEmit`, targeted ESLint, `npm run build`, PDF worker bundling and existing evidence/backup checks should stay green.
- No automatic AI OCR on selection; no Gmail, external API, real owner/resident documents or financial actions. Meeting invitations/proxy rules and actual residential communications need legal/data-protection review.
