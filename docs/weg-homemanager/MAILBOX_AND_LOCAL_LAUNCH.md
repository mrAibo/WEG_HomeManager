# E8 — WEG HomeManager Mailbox, Sending and Local Launch

**Status: integration preparation in Draft PR, synthetic-only. No real Gmail credentials or emails processed.**

## What is already implemented
The HaVeWa-derived backend already has `imapflow` and `mailparser` for incoming mail/attachments, `nodemailer` for SMTP, persistent Inbox/Outbox, duplicate protection, threading and scheduler. WEG HomeManager adds:
- **Gmail incoming fail-closed scoping:** `imap.gmail.com` imports only an explicit label selected as IMAP mailbox. `INBOX`, `[Gmail]/All Mail`, `Sent Mail`, Spam, Trash and wildcard are refused. Warning: authenticating through IMAP still gives the app credentials broader account access even though the importer selects one folder.
- **Outgoing explicit human approval:** in the standard compose dialog, `Senden` schedules or sends only when the writer manually checks `Ich habe Empfänger, Inhalt und Anhänge geprüft`. Without this checkbox, the email stays as `ENTWURF`. `Als Entwurf speichern` never sends. This does not rewrite every inherited bulk/system-email workflow; review those separately before production.
- **No false sent status:** SMTP is required to report a message as sent; unconfigured SMTP now throws, and the outbox marks delivery as failed rather than incorrectly `GESENDET`.
- **Gmail from-account check:** Gmail `From: username+tag@gmail.com` is allowed when authenticated as `username@gmail.com`, but using an unrelated Gmail sender is rejected. `Reply-To` is set to the configured sender. The mail server still determines whether the claimed `From` is accepted or rewritten.

## Example account and safe account isolation
The **plus address is not a separate inbox**:
- intended recipient/sender: `crownru+weg@gmail.com`;
- actual Gmail account username: `crownru@gmail.com`;
- incoming server `imap.gmail.com`, 993, SSL on;
- create a Gmail filter for messages **to** `crownru+weg@gmail.com`, apply user label `WEG-HomeManager`; ensure label is visible in IMAP, then set **IMAP-Mailbox = `WEG-HomeManager`**. Never use `INBOX`.
- outgoing `smtp.gmail.com`, 465 SSL/TLS; SMTP login `crownru@gmail.com`, From `crownru+weg@gmail.com`.
- In Gmail web: Settings → All Settings → Accounts and import → Send mail as: register and verify `crownru+weg@gmail.com`, set its Reply-To to the tagged address. Send to a controlled test mailbox and inspect raw `From`/`Reply-To`/delivery. Gmail may rewrite unsupported aliases; do not claim it already works without this real test.

**Authentication is not connected.** This fork still has traditional IMAP/SMTP user/password fields stored by the upstream tenant settings code. Google prefers OAuth; app passwords require eligible two-step-verified accounts and are broad credentials. Do NOT enter a personal Gmail app password into the synthetic database (demo password and service-account gates are not production-ready). Before activating with real mail, prefer a separate account or OAuth with encrypted token storage, revoke/rotate controls, audited operations and user approval.

**Model actions:** AI may transcribe or propose a reply, but it must never call SMTP or the outbox autonomously. Existing REST Bearer mutation kill switch remains. All outbox/manual-send actions must be authorization reviewed before connecting real email accounts. No emails were sent during tests.

## Local launch (with or without Docker)

Double-click `start-weg-homemanager.cmd` in the repository or run:

```powershell
cd "C:\Users\crown\Downloads\Projects\WEG_HomeManager"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-weg-local.ps1
```

- Existing Aibo setup: Docker Desktop provides only the **PostgreSQL test database** at `127.0.0.1:5432`; Next.js runs natively in Windows on `127.0.0.1:3000`. The launcher checks current Node 24, `.env`, Next production build, DB TCP listener and avoids a duplicate app startup. It does not start Docker or modify DB, firewall, operating system accounts or secrets.
- **Docker-free future:** install PostgreSQL 16+ natively as a Windows service (or another approved PostgreSQL host), create a new distinct DB/user with strong private credentials, point the protected `DATABASE_URL` to that DB, apply `npx prisma migrate deploy`, `npx prisma generate`, `npm ci`, and `npm run build` as appropriate; then use the exact same launcher. WEG does **not require Docker** as a runtime dependency; only PostgreSQL is required. The launcher doesn't provision PostgreSQL.
- Never try to attach the native Windows server to Docker's existing `havewa-db` volume or run both DBs bound on localhost port 5432. A future migration, if required, needs a scheduled matched DB and file-store backup/restore, never an in-place reuse of Docker's data directory.
- Local development: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-weg-local.ps1 -Dev`. Normal tests: `npm test`, `npm run build`.

## Branding and attribution
Default login/setup/sidebar/About use new **WEG HomeManager** vector assets and UI strings. Any administrator-uploaded tenant logo is still respected. Original HaVeWa source history, AGPL-3.0 notices and author credit remain explicitly in About and README, without showing promotional HaVeWa artwork as the main product.
