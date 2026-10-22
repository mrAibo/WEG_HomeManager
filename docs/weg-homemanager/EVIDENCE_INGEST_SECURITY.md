# E3 Evidence ingestion — structural gate and release conditions

**2026-10-22 — Development only. Not a malware-clearance certificate.**

WEG HomeManager stores original PDF/JPEG/PNG bytes as tenant-scoped Evidence through the existing HaVeWa storage. Evidence file SHA-256 is bound to the human-reviewed Case version. There is **no OCR, document execution, inline web rendering or LLM transmission** in this increment.

## Before writing any file

The existing authenticated human-only upload server action enforces per-tenant manager permissions, file size 1–10 MiB and a strict MIME signature computed from actual bytes. The additional `src/lib/ai-evidence-inspection.ts` gate now rejects:

- **PDF (separate permission-restricted child process):** unsupported header/version, missing terminal `%%EOF`, invalid or encrypted structures that `pdf-lib` cannot load, 0 or more than 120 pages, implausible pages, and visible/parsed PDF action or embedded-file markers such as `/JavaScript`, `/JS`, `/OpenAction`, `/AA`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, `/XFA`, and form action tokens. Existing installed `pdf-lib` is reused.
- **PNG:** invalid signature/chunk sizes/CRC, unsupported metadata/extensions, invalid IHDR, missing IDAT/IEND, trailing bytes, declared dimensions above 8192 per side or 24 megapixels. PNG text/animated metadata and embedded ICC profiles are intentionally unsupported.
- **JPEG:** malformed outer marker segments, missing SOF/SOS and EOI, excessive markers and declared dimensions above 8192 per side or 24 megapixels. The entropy-compressed image is **not** decoded; this is only bounded marker-level validation.

**Failed uploads are rejected without storing their bytes.** This is deliberate: the project does not yet maintain a secured quarantine service or retention/access policy for suspicious binary files. Rejected files must not go to normal Evidence storage merely for later review.

An accepted file is *structurally plausible*, **not verified malware-free**. The application continues to serve accepted bytes only as authenticated attachments with `nosniff`, `sandbox`, `no-store` and SHA-256 integrity checks. Never interpret acceptance as permission to execute content.

## Before accepting real customer files (unmet release gates)

1. **Single-PC decision:** use the computer's existing managed antivirus. Verify active scanning covers the private Evidence directory and any Docker/WSL mount, signed updates work and malware detections are visible to the administrator. **No separate ClamAV is required** for this deployment plan.
2. Keep uploaded bytes in **private, access-controlled local storage**, with quota and cleanup. The host antivirus may quarantine malicious bytes asynchronously; downloads and approvals must continue to verify original SHA-256 and fail closed if a file disappears or changes. A separate scanning/quarantine service remains **optional**, and should only be reevaluated for public anonymous uploads, third-party imports or binding organizational policy.
3. The PDF parser now runs as a separate **Node 24 child process** with filesystem permission restrictions, no inherited secrets, process concurrency, V8 heap and wall-time limits (see `PDF_WORKER_ISOLATION.md`). It is **not** a complete OS sandbox: network egress and total RSS still require host restrictions. Future OCR/image decoding must run outside Next.js under stricter OS/container limits.
4. Record scan decision, timestamp, scanner/definitions version, hashes and human uploader in mandatory tenant-scoped audit events. Do not store raw malware samples in app logs, emails, dashboards or source control.
5. Enforce per-tenant quotas, throttling, local file ACLs, download audit and deletion/retention policy (DSGVO). Verify backups include private Evidence; document how to recover files quarantined by the host antivirus.
6. Re-run the adversarial test corpus (malformed PDF object streams, active content, polyglots, decompression bombs, malformed PNG/JPEG and EICAR with permission) inside **isolated staging** with no network egress before production approval.

## Verified synthetic tests

- Unit test suite `src/lib/ai-evidence-inspection.test.ts` covers accepted generated PDF and PNG/JPEG markers; rejects fake PDFs, active actions, broken CRC, PNG metadata and oversize dimensions, and invalid JPEG marker streams.
- Synthetic DB test `scripts/e3-evidence-db-smoke.ts` verifies a fake header-only PDF is rejected and not stored, while a genuine pdf-lib fixture can be saved and SHA-256 bound.
- Existing Evidence approval, DB snapshot integrity, protected download and coordinated PostgreSQL+file-store restore scripts now create real `pdf-lib` PDFs rather than relying on pseudo-PDFs.

## Operational decision

Keep the entire PR chain in Draft. Only synthetic files are permitted during this phase. **Do not enable real file imports, OCR, external LLM calls or model-controlled REST writes** until OS permission/firewall, host antivirus coverage, privacy and P0 REST Bearer authorization gates are reviewed.
