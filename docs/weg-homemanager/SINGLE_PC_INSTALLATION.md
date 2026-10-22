# WEG HomeManager — single Windows PC installation security gate

**E6 · 2026-10-22 · preparation, NOT a finished installer or production authorization.**
No extra ClamAV: the operator will use the computer's centrally managed antivirus.
All scripts here are **read-only by default** and were exercised on Aibo with synthetic data.

## 1. Verification before any configuration changes

From the project root on Windows with PowerShell 5.1 or later:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e6-single-pc-preflight.ps1
# Machine-readable, no secrets printed:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e6-single-pc-preflight.ps1 -Json
node scripts/e6-worker-package-smoke.mjs
```

The preflight returns exit code **1** if a blocking check fails, or **0** without any hard blocker. Warnings still require administrator review. It never calls `Set-Acl`, changes credentials/firewall/services, writes files, starts/stops Docker or elevates. It checks Node 24, Next production build, worker assets, local DB connection shape, weak demo password, Auth.js secret length, binding of WEG ports 3000/5432, Docker publishing, broad NTFS file-store write ACLs, Windows AV registration, Defender exclusions where readable and a separate service identity. Raw DB URL, passwords and secret values are never printed.

**Results observed on Aibo before installation changes:**
- PostgreSQL Docker port `127.0.0.1:5432` — PASS; Next `127.0.0.1:3000` — PASS.
- Node 24, source worker assets, Next build, private file-store ACL broad-grant check, Auth.js secret existence/length and registered Windows Defender — PASS.
- **FAIL: demo PostgreSQL password** `havewa` remains in synthetic-only `docker-compose.yml` and its local database credentials. **Do not connect real users/documents to this DB**.
- **WARN:** running Next.js under the interactive account instead of a confirmed dedicated service identity; Defender exclusion configuration could not be inspected by this PowerShell environment (Windows Security Center detecting Defender does not prove all Evidence files are scanned).
- Other Docker workloads on Aibo (some with LAN-facing ports) **belong to other projects** and were deliberately neither changed nor represented as WEG-specific findings.

## 2. Prepare the fresh production database, never overwrite the demo DB

The optional **example only** at `deploy/single-pc/docker-compose.db.example.yml` is for a new installation. It requires a strong `WEG_DB_PASSWORD`, binds PostgreSQL to `127.0.0.1:5432` and uses a distinct `weg-homemanager-db` volume, user `wegapp` and database `weg_home_manager`. It is not a migration script; DO NOT apply it to the existing `havewa-db` volume, change the current demo `.env`, or start it at the same port without a planned maintenance window. `POSTGRES_PASSWORD` only initializes a **new** database volume; changing the environment variable does not rotate an existing user's password.

For an approved **fresh** install only, provision a strong password in a private secret/environment file outside Git, create a matching URL with URL-encoded special characters, then execute Prisma migrations on the new empty DB after a backup/rollback plan. Save credentials in the Windows credentials vault or a protected service configuration with NTFS ACLs; do not put them in task action arguments, command-line flags, scripts checked into Git or telemetry.

## 3. Dedicated, low-privilege Windows identity

- Create a dedicated **standard Windows service user**, with no membership in Administrators, Remote Desktop Users or interactive sharing groups. Assign only the rights necessary to run Node, read app release files and write private `storage/documents` and logs. Use an approved Windows service manager/Task Scheduler policy with secure credential storage and start/stop/restart behavior.
- **Manual ACL review is mandatory**. Program files and `node_modules` should be writable by administrators during controlled updates, **readable only** by the service account at runtime. Private `.env`, stored Evidence, backup sets and any financial/WEG exports must not inherit broad `Everyone`, generic `Users` or `Authenticated Users` write ACLs. Include the dedicated account, SYSTEM and tightly controlled administrators; do not revoke access from the currently running developer account until an install rollback exists.
- Next.js listens on `127.0.0.1:3000` for a single-device installation. PostgreSQL listens on `127.0.0.1:5432`. Keep firewall default incoming deny for both; never map the DB to `0.0.0.0` or expose an administration panel to the internet. If remote users are later required, use authenticated reverse proxy/TLS/network segmentation after a separate security review, never simply bind to all addresses.
- Restrict **outbound network connectivity of the PDF parser** with a real OS-level mechanism (e.g. constrained account/AppContainer/isolated sidecar). The current worker is another `node.exe` under the same Windows identity: a blanket firewall rule for `node.exe` could also disrupt Next.js. Therefore **per-worker no-egress protection is NOT yet demonstrated**. Node `--permission` is only a filesystem capability restriction, not a replacement for OS process isolation.
- Put CPU/RSS budget, disk quotas and monitored child-process supervision in place before accepting adversarial files; the current 128 MiB V8 heap limit is not a total Windows process memory cap. The existing 8s timeout and two-worker limit are useful but insufficient alone.

Do not automatically create or modify these Windows identities/permissions in a development session. Use change control and record an owner-approved installation and rollback.

## 4. Existing computer antivirus, not a second antivirus server

Check Windows Security/your enterprise AV reports up-to-date real-time protection, successful signature updates and handling of a safe **synthetic** detection test; explicitly verify the private `storage/documents` directory and actual Docker/WSL volume path if used are covered. Verify any exclusions. Define an incident and recovery procedure for Evidence files removed/quarantined by host antivirus; the application's SHA-256 validation already rejects changed/missing evidence before approval/copy. The preflight **does not** certify coverage or absence of malware.

## 5. Verify actual installation package contains the worker

`node scripts/e6-worker-package-smoke.mjs` stages `src/server/workers/pdf-inspect-worker.mjs` plus **recursively resolved installed runtime dependency packages** into an OS temporary directory (without any .env, DB, WEG files or external download), then runs Node 24 `--permission` against this isolated bundle:
1. genuine synthetic PDF passes and its original SHA-256 is recorded;
2. malformed PDF is rejected;
3. deleting `pdf-lib` from staged runtime causes a **fail-closed**, not an in-process fallback;
4. staged files are removed after the test.

This proves **worker/dependency assets can be packaged together**, not that we have a complete installer or an application self-update. The installer must include these files with correct paths, and must run this test after extraction. The CI workflow runs this smoke without a database.

## 6. Operational release gates

Real WEG/property data remains prohibited in this development setup until:
- a fresh non-demo DB secret and dedicated service identity are in use, file ACLs and loopback firewall verified;
- backup + restore of matching PostgreSQL and private files works under the service account, with encrypted offsite retention and a rollback drill;
- host antivirus actually covers the Evidence directory; worker outbound access and OS resource limits are reviewed;
- DSGVO retention/deletion/data access and full tenant-object authorization have been audited, including remaining read-scope parts of GitHub Issue #11;
- signed/trusted installer, tested fresh install and upgrades, system health/logging and operator documentation are ready.

**No changes were applied to the host security settings or its unrelated containers in this PR.** The test/demo database retains its existing test credentials pending an explicitly approved **fresh** deployment.
