# E5: PDF inspection in a bounded Node subprocess

Status: 2026-10-22. **Synthetic-only.** Common host antivirus is assumed for eventual single-PC deployment; NO separate ClamAV required by this stage.

## What actually changed

The existing `addCaseEvidence` server workflow still checks Auth.js role/tenant, file size/magic and validates content **before** writing the original file to HaVeWa storage. For PDF, `inspectEvidence` now delegates structural parsing to `src/server/workers/pdf-inspect-worker.mjs` via `src/lib/ai-pdf-process.ts`. JPEG/PNG structural marker checks are still bounded inside Next.js (no image decode/OCR).

Child process protections:
- Node.js **24+ mandatory**; start child with `--permission`, read access only to the worker file and `node_modules`, **no filesystem write grants** and no permission to spawn other child processes. No permissive fallback if the Node version/worker/process is unsupported. `--permission` is an application/runtime permission restriction, not an OS user boundary.
- No inherited `.env`, `DATABASE_URL`, `AUTH_SECRET` or external API credentials: worker gets only `NODE_ENV=production`. PDF bytes are transferred through **stdin**, not shell commands/temporary files/arguments; the worker returns only bounded JSON verdicts, not document contents.
- File-size ceiling **10 MiB**, V8 old-space cap **128 MiB** (NOT a total RSS/native-memory limit), **8-second timeout** with child termination, and at most **two concurrent PDF parser processes per Next.js instance**. Failure, timeout, unavailable worker, invalid protocol or busy pool blocks upload **before file persistence**.
- Existing conservative PDF checks are preserved in the subprocess: pdf-lib parse, 1–120 pages, page dimensions, denylisted action/embed tokens; raw bytes remain unmodified and SHA-256 bound to Case/Evidence and human COPY_ONLY approval.

## Limitations — do not describe this as a complete sandbox

**Important:** Node's `--permission` does **not** implement network isolation, an independent operating-system account, a total OS memory/CPU hard limit or protection against all native vulnerabilities. A process can still exhaust non-V8 memory or, absent host firewall isolation, initiate network connections. Deploy with a restricted service identity, localhost DB, restrictive host firewall and OS resource controls. If handling adversarial untrusted internet documents, move the worker to an OS/container sandbox with **no network egress** and tested CPU/memory/file mounts before production approval.

The inspector file must be bundled with the installed application at `src/server/workers/pdf-inspect-worker.mjs` and `node_modules` must be present for its allowlisted imports. Standard source-repo `next start` is tested; standalone-packaged installers must include these assets and be verified independently. Missing assets **fail closed**, not fall back to in-process parsing.

This is **not** malware scanning. The user expects the machine to have a conventional antivirus. Before real deployment ensure its effective coverage of `storage/documents` and the deployment volume, monitor detections, and define an incident response. Structural inspection does not eliminate threats from prompt-injection text inside otherwise valid documents.

## Tested

- `src/lib/ai-pdf-process.test.ts`: real subprocess accepts valid synthetic PDF, rejects malformed/oversized PDFs, refuses concurrent excess jobs, verifies Node filesystem permissions refuse access to repo `.gitignore`, and returns generic error messages.
- Previous PDF/JPEG/PNG structural test suite runs unchanged against the process boundary (including active PDF action detections).
- Synthetic PostgreSQL tests prove Evidence still saves genuine PDF and approvals fail if original file hash changes.
- Synthetic Chrome and coordinated backup/restore tests should run after any worker changes, with no real WEG documents.

## Remaining before real users / AI OCR

- Per-device least-privileged OS service identity, file ACLs and firewall egress policy for subprocess.
- Process supervision and real installer packaging, centralized rate limits/storage quotas, antivirus coverage verification, audit/retention and DSGVO process.
- If OCR is added, run the OCR renderer in a **separate** isolated process and treat its extracted text as untrusted. No model may issue external writes without explicit version-bound human approval.
