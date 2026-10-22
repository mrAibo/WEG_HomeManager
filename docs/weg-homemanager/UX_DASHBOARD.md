# UX / Dashboard — AI-first and novice-first specification

**Decision (2026-10-22):** a responsive **WebGUI** inside HaVeWa's existing Next.js application. Enhance as an installable PWA only where browser capabilities and measured user needs warrant it. No native desktop/mobile application for MVP.

## Why WebGUI wins
| Approach | Value | Cost / risk | Decision |
|---|---|---|---|
| Responsive WebGUI in existing Next.js | Windows/macOS/Linux/phone, instant updates, one codebase, reuse existing auth and UI | Browser file/notification permissions; careful mobile design needed | **MVP** |
| PWA progressive enhancement | Homescreen install, camera/file access, optional limited offline draft capture | Service worker cache privacy, stale data and sync complexity | **After WebGUI base**, no custom offline sync in MVP |
| Tauri/native desktop/mobile | Dedicated system integrations and local-first opportunities | Multiple builds and app distribution, two interface surfaces or wrappers | **Defer** until clear requirement |

## Dashboard first — not an admin panel full of tables
Entry on small screen and desktop:
1. Warm but concise contextual header, building selector if user has more than one.
2. One large action field: **Was kann ich für Sie erledigen?**
3. Three supported actions: **Foto aufnehmen**, **Dokument hochladen**, **Frage stellen**. "Spracheingabe" is an optional enhancement (native browser where supported).
4. **Jetzt wichtig**: urgent issues, time-critical deadlines. Explain what makes an item urgent.
5. **Zur Freigabe**: AI drafts ready for human review; clear *Bearbeiten* and *Prüfen & freigeben* next actions.
6. **In Bearbeitung**: short list of maintenance or paperwork cases with owner of next step and expected next update.
7. **Finanzen** and **Termine**: simple summary first; detailed tables by explicit navigation.
8. For novice users, hide rarely used expert sections behind progressive disclosure, never behind a confusing "newbie mode" requiring configuration.

### Desktop concept (wireframe, not coded)
```text
+--------------------------------------------------------------------------------+
| WEG HomeManager           Mein Haus ▾                  Hilfe (?)   Profil      |
|--------------------------------------------------------------------------------|
| Was kann ich für Sie erledigen?                                               |
| [ Beschreiben Sie Ihr Anliegen in einem Satz...                      (Senden) ]|
| [ Foto aufnehmen ] [ Dokument hochladen ] [ Frage stellen ]                   |
|--------------------------------------------------------------------------------|
| Jetzt wichtig          | Zur Freigabe             | In Bearbeitung             |
| Wasserschaden prüfen   | Brief an Handwerker      | Dachprüfung • Antwort offen|
|--------------------------------------------------------------------------------|
| Finanzen: leicht lesbare Übersicht | Nächste Termine | Letzte Dokumente       |
+--------------------------------------------------------------------------------+
```

### Mobile concept
Single column; top action first; preview *max 2–3* important cards before "Alle ansehen".
Never bury emergency help, drafts awaiting approval or document upload behind navigation.
Use native camera/photo/file picker on mobile via standard HTML inputs; no separate app permission labyrinth.

## Primary 4-step workflow
1. **Anliegen erfassen:** typed message, photo, PDF or voice; optional guided follow-up.
2. **KI-Vorschlag ansehen:** short diagnosis hypotheses (not certainty), source image/text location, proposed next actions and draft documents.
3. **Bearbeiten oder bestätigen:** every extracted value and draft may be edited; comparison view shows differences; changing draft invalidates prior approval.
4. **Status verfolgen:** explicit who owns the next step, what was approved, what was actually sent (if authorized), deadlines and replies.

## Design tokens and controls
- Reuse HaVeWa's existing shadcn/ui, Tailwind, icons and form primitives. Do not add a second UI kit.
- Clear hierarchy, generous whitespace, readable system fonts, sufficient contrast and large touch targets.
- Plain German labels; short inline explanations of WEG jargon (e.g. `Sonderumlage`), clear currency units and full VAT context.
- Only one strong primary CTA per screen; secondary actions should not compete visually.
- Honest empty/loading/error/partial-state messages and obvious manual fallback for AI unavailability.
- Never announce something sent or completed before the connected provider confirms success.
- Accessible dialog focus, captions/labels, keyboard access, screen-reader descriptions. WCAG 2.2 AA is a design/testing goal, not yet verified.
- Avoid unsolicited overlays, banners, performance-heavy animations, dashboard clutter and vanity charts.
- Table exports and source PDF remain accessible to advanced users in deeper detail views.

## Dashboard cards by role
- **Manager:** urgent repairs, overdue actions, approvals, financial reconciliation, WEG meeting deadlines.
- **Owner:** own submitted cases, approved decisions, permitted documents and own balance, never neighbors' private information.
- **Beirat:** reviewable committee material and resolutions only within granted authority.
- **External trade:** no general Dashboard; only specifically approved work-package access, if a contractor portal is implemented later.

## Test before claiming usability
- Recruit 3–5 novice German-speaking testers per iteration, ideally including older and mobile-only users.
- Tasks: take photo of a defect, edit AI-inferred location, reject and correct a draft, find pending approval and identify a payment requiring authorization.
- Observe task completion, confusion points, help requests, error recoverability and keyboard/screen-reader accessibility.
- Design objective: routine actions in a few obvious steps; timings are measured, **not** performance claims.
- Review on ~360px mobile width and desktop at 1280px; no horizontal scrolling for core actions.

## Development gates
- Design docs/wireframe now.
- Implement dashboard with actual reused HaVeWa components only after upstream import and scope/a11y audit.
- Avoid speculative native apps, custom design frameworks and new dependencies without measured need.
