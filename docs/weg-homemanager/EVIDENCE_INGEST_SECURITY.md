# E3 Evidence ingestion — structural gate and release conditions

**2026-10-22 — Development only. Not a malware-clearance certificate.**

WEG HomeManager stores original PDF/JPEG/PNG bytes as tenant-scoped Evidence through the existing HaVeWa storage. Evidence file SHA-256 is bound to the human-reviewed Case version. There is **no OCR, document execution, inline web rendering or LLM transmission** in this increment.

## Before writing any file

The existing authenticated human-only upload server action enforces per-tenant manager permissions, file size 1–10 MiB and a strict MIME signature computed from actual bytes. The additional `src/lib/ai-evidence-inspection.ts` gate now rejects:

- **PDF:** unsupported header/version, missing terminal `%%EOF`, invalid or encrypted structures that `pdf-lib` cannot load, 0 or more than 120 pages, implausible pages, and visible/parsed PDF action or embedded-file markers such as `/JavaScript`, `/JS`, `/OpenAction`, `/AA`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, `/XFA`, and form action tokens. Existing installed `pdf-lib` is reused.
- **PNG:** invalid signature/chunk sizes/CRC, unsupported metadata/extensions, invalid IHDR, missing IDAT/IEND, trailing bytes, declared dimensions above 8192 per side or 24 megapixels. PNG text/animated metadata and embedded ICC profiles are intentionally unsupported.
- **JPEG:** malformed outer marker segments, missing SOF/SOS and EOI, excessive markers and declared dimensions above 8192 per side or 24 megapixels. The entropy-compressed image is **not** decoded; this is only bounded marker-level validation.

**Failed uploads are rejected without storing their bytes.** This is deliberate: the project does not yet maintain a secured quarantine service or retention/access policy for suspicious binary files. Rejected files must not go to normal Evidence storage merely for later review.

An accepted file is *structurally plausible*, **not verified malware-free**. The application continues to serve accepted bytes only as authenticated attachments with `nosniff`, `sandbox`, `no-store` and SHA-256 integrity checks. Never interpret acceptance as permission to execute content.

## Before accepting real customer files (unmet release gates)

1. Install and configure a supported, independently updated antimalware engine (for example ClamAV or a company-approved scanning gateway) with exact engine/signature versions, health checks and failure handling. Do not claim ClamAV is installed on Aibo; it is **not**.
2. Move new uploads into **non-public, isolated quarantine**, with restrictive filesystem permissions, retention limits and quotas; perform scan with a fixed resource/time budget. Missing/unavailable/timed-out scanner must **fail closed**; don't approve, OCR, expose or copy such Evidence into production. Only atomic promotion of scan-clean bytes plus exact digest may make a file usable.
3. Isolate PDF/image parser processes in a low-privilege sandbox or sidecar before further rendering/OCR, with CPU, memory, page and pixel limits. Parsing malicious files in the Next.js process is a residual risk even with `pdf-lib`. Reevaluate the supported format set with the operator.
4. Record scan decision, timestamp, scanner/definitions version, hashes and human uploader in mandatory tenant-scoped audit events. Do not store raw malware samples in app logs, emails, dashboards or source control.
5. Enforce per-tenant quotas, request throttling, storage permissions, download audit and an explicit deletion/retention policy (DSGVO). Validate backups cover quarantine and published storage separately and document whether quarantine is intentionally excluded.
6. Re-run the adversarial test corpus (malformed PDF object streams, active content, polyglots, decompression bombs, malformed PNG/JPEG and EICAR with permission) inside **isolated staging** with no network egress before production approval.

## Verified synthetic tests

- Unit test suite `src/lib/ai-evidence-inspection.test.ts` covers accepted generated PDF and PNG/JPEG markers; rejects fake PDFs, active actions, broken CRC, PNG metadata and oversize dimensions, and invalid JPEG marker streams.
- Synthetic DB test `scripts/e3-evidence-db-smoke.ts` verifies a fake header-only PDF is rejected and not stored, while a genuine pdf-lib fixture can be saved and SHA-256 bound.
- Existing Evidence approval, DB snapshot integrity, protected download and coordinated PostgreSQL+file-store restore scripts now create real `pdf-lib` PDFs rather than relying on pseudo-PDFs.

## Operational decision

Keep the entire PR chain in Draft. Only synthetic files are permitted during this phase. **Do not enable real file imports, OCR, external LLM calls or model-controlled REST writes** until malware/quarantine, privacy, and P0 REST Bearer authorization gates are reviewed.
