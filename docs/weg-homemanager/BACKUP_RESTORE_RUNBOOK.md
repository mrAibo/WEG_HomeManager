# WEG HomeManager – Backup & Restore (PostgreSQL + Evidence)

**Status:** 2026-10-22 · synthetic local restore drill verified. **NOT a production-ready automated backup or disaster-recovery guarantee.**

## Why two coordinated backups are mandatory

WEG HomeManager uses **PostgreSQL** for WEG tenancy, Cases, proposals, approval/audit metadata and `AiEvidence` rows; file bytes live in HaVeWa's `storage/documents` local filesystem. PostgreSQL alone does **not** contain PDF/JPEG/PNG originals. File storage alone cannot reconstitute authorization, audit or document associations.

Each defensible restore point must contain:
1. One consistent PostgreSQL dump/snapshot, **plus**
2. the complete corresponding private file-store snapshot, **plus**
3. a backup manifest with file lengths and SHA-256 hashes and the matching application version/migration level.

**Consistency requirement:** because writes to PostgreSQL and local files are not one transaction, suspend **all** application/API/background/automation writers, wait for in-flight uploads to finish, then capture **both** sides before releasing the write freeze. Even an online-consistent `pg_dump` cannot freeze external files. Database/file snapshots taken independently during writes may be unusable or inconsistent. Do **not** assume stopping only one Next.js process is sufficient on a multi-process installation.

## Local verified, synthetic-only drill

Source: `scripts/e3-backup-restore-drill.ts`. It uses PostgreSQL 16's official `pg_dump`, `pg_restore`, `createdb` and `dropdb` tools **inside** the existing Docker container `havewa-db`, plus native Node.js filesystem APIs. No extra runtime npm dependency.

**Hard preflight guards** refuse execution unless:
- `DATABASE_URL` targets **localhost/127.0.0.1:5432/havewa**;
- container name and `POSTGRES_DB/POSTGRES_USER` both equal `havewa`;
- exactly one synthetic tenant, `WEG Demo – Sechs Wohnungen`, exists, and **all** user emails end in `.invalid`;
- port `127.0.0.1:3000` is not listening;
- `storage/documents` is not a symbolic link and holds at most 300 ordinary files, each at most 10 MiB.

Do not bypass these guards to run against real users. They intentionally prevent production operation.

From the repository root on the isolated Aibo development host, stop the **local WEG Next.js process** (not PostgreSQL or unrelated containers), then run:

```powershell
node --env-file=.env --import tsx scripts/e3-backup-restore-drill.ts
```

The drill creates one fake Case and PDF through real E3 APIs, submits and COPY_ONLY-approves it, copies the entire private file store and captures the PostgreSQL custom-format dump, then restores into a randomly named **`weg_restore_<uuid>` scratch database** and private OS temporary directory. It checks:
- restored tenant, Case, Evidence, proposal and human approval;
- manifest hash binding approval to every original Evidence ID/name/MIME/size/content SHA-256;
- all restored files' hash and count against the source snapshot, and Evidence file bytes/size against restored DB metadata.

Finally it drops **only its own uniquely named scratch database**, removes temporary dump and restored files, deletes **only its own synthetic Case** and its test attachment, and disconnects. No real WEG data is read or copied as part of the allowed drill. Check warning output if interrupted: forcibly terminated processes may leave a scratch DB or temporary private dump requiring **manual inspection**, not broad automated cleanup. The original production database is **never** a restore target.

Successful local execution on 2026-10-22:
- `E3_COORDINATED_RESTORE_PASS`, scratch Postgres restore plus recovered file store;
- synthetic original Case, Evidence manifest and approval checked;
- prior file corruption / restoration checks passed in `scripts/e3-evidence-snapshot-db-smoke.ts`.

**Boundary:** this test validates one synthetic restore point, not external archival retention, off-site failover, restored Next.js startup against the scratch pair, continuous PITR or disaster RTO/RPO.

## Production runbook – design and approvals (NOT yet implemented)

1. **Set an acceptable RPO and RTO** with the WEG operator; define recovery owners and a quarterly staging restore drill. Inventory databases, file mounts/volumes, secrets, generated documents and any external integrations.
2. **Prepare an encrypted, access-restricted backup destination** with controlled retention, immutable/off-site copies, a dedicated service identity, tested decryption and separated credentials. A PostgreSQL dump can contain user password hashes and tenant/private data; never check a dump into Git.
3. **Enter write maintenance:** stop or put **every** Next.js replica, HTTP/API/MCP writer, upload task and background worker into maintenance. Drain in-flight requests and verify no service can modify either database or file storage. Do not start capturing until this gate passes.
4. **Capture paired backups:** PostgreSQL official custom-format dump or coordinated DB snapshot; copy the entire private `storage/documents` filesystem (including HaVeWa's non-E3 Document objects). Capture a SHA-256 file manifest, migration version, creation time, application commit, and explicit identity of the matching database/file pair. If either side fails, reject **both** as an incomplete restore point.
5. **Validate before release:** database dump integrity (`pg_restore --list`), full file manifest and backup destination integrity; only then resume writers. Monitor backup failures without printing secrets, case descriptions or file contents.
6. **Restore in staging first:** isolate a new PostgreSQL DB and a new file-store directory, restore the **matching pair**, verify counts, hashes, Evidence-to-Case FK scoping, proposal/approval manifest and sample authenticated reads. Validate the application release/migration version and server-side roles before any cut-over. Never point a fresh DB at the production file store while unverified.
7. **Cut over only after operator approval**, full validation, documented rollback, and recovery rehearsal. Record missing files, migration mismatch, external attachments and degraded modes explicitly.

## Open security gates

- No production-ready maintenance coordinator for all writers/replicas; no automatic scheduling or immutable offsite encrypted backup policy.
- No full PostgreSQL point-in-time recovery/WAL restore or demonstrated multi-node recovery.
- No automatic antimalware/robust PDF/image parser, quarantine or sandbox processing; accepted signatures are basic.
- No formal retention/DSGVO delete/extract policy, detailed download audit or full per-object permission matrix.
- Existing REST Bearer write interface remains P0 (#11). Do not grant model credentials or automatic send/pay/contract rights.

**Decision:** continue using synthetic-only data. Prepare storage and malware controls before OCR/LLM ingestion and before real-person data is permitted.
