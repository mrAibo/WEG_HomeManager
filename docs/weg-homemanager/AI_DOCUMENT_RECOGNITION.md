# E7 — provider-agnostic AI transcription with human verification

**Status 2026-10-22: synthetic-only development, no real private documents or paid provider requests tested.** E7 stacks on E6 PR #22; no release to main.

## Decision

The user chooses the model in the **existing** HaVeWa **Einstellungen → Integrationen → KI** panel. E7 does **not** select Astra, Opus or another heavyweight default, and does **not** install or depend on Tesseract/PaddleOCR. Model configuration is already tenant-scoped (`Tenant.aiProvider`, `aiBaseUrl`, `aiModel`, `aiApiKey`). No new password field, tenant override or second credentials system is introduced.

**Provider adapters currently implemented:**

| Existing setting | Image (JPEG/PNG) | PDF |
| --- | --- | --- |
| Anthropic messages | base64 image block | base64 document block |
| OpenAI-compatible chat | base64 image URL content | OpenAI **Responses API** `input_file` |

- OpenAI-compatible models from OpenRouter, Ollama, LM Studio, hosted gateways, etc. **work only if that server and chosen model implement the required vision/chat/Responses endpoint**. No SDK or API standard makes literally every model support images/PDF. When a provider cannot read the input, the application returns a generic failure and never silently substitutes another model.
- Admin-configured endpoint must be HTTPS, except plain HTTP to loopback localhost. This is **not** a complete SSRF or data-loss prevention solution. Admin-configured models may reside in the cloud; validate endpoint and contract terms before private use.
- No default model is inferred: `aiModel`, provider and API key must be explicitly configured in existing Settings. The existing `KI-Verbindung testen` checks text chat only, **not** image/PDF support.
- Existing SDK dependencies `openai`, `@anthropic-ai/sdk` and `zod` are reused. No new runtime dependency.

## UI and data flow

1. ADMIN/VERWALTER uploads a PDF/JPEG/PNG in a saved Case using existing file validation, tenant scoping and SHA-256 storage. Ordinary Evidence upload does **not** call a model.
2. Below the Evidence file, a German-language form shows the configured provider and model. The user must explicitly tick agreement to transmit **that specific original file** to the chosen service, then press `Text mit KI erkennen`. A cloud model may receive personal data; users need permission and appropriate data protection terms before sending real documents.
3. The server action verifies Auth.js identity, tenant+Case+Evidence, DRAFT proposal, duplicate recognition, exact original SHA-256 and file size before transmitting. No publicly accessible model endpoint/API tool is exposed. It uses 30-second provider timeouts and disables retries. Provider errors are sanitized; original API key, response headers or document contents do not appear in error messages.
4. Model instructions demand transcription, no guesswork for amounts/dates/IBAN and `[unleserlich]` for uncertainty. Model response must be **JSON** with `text` (up to 20,000 characters) and `unclear` (up to 30 short descriptions). Invalid model output fails closed; this does not make a valid output **true**.
5. **Separate database entity** `AiRecognition` stores original Evidence hash, provider, model, model output, uncertainties and audit trail as `DRAFT` (untrusted). It does not edit `AiProposal`, issue COPY_ONLY approval, create a Ticket, e-mail, bookkeeping item or payment. One recognition per original Evidence for first MVP.
6. User opens the original Evidence attachment, corrects the transcription in an editable text field, ticks **personal comparison** and stores `REVIEWED` with `reviewedById` and timestamp. Human-reviewed transcription is immutable in this MVP; further revisions require a future audited workflow. Changed/missing original bytes and non-DRAFT proposals block review. Audit events: `recognition_generated`, `recognition_human_reviewed`.
7. All prior text proposals remain **TEMPLATE** and their existing version-bound COPY_ONLY approval remains separate. Model transcription never becomes a direct instruction to any executor.

## Security, privacy and functional limits

- **No actual cloud provider request has been exercised:** adapter-level tests mock both SDKs and the database smoke uses a supplied in-memory recognizer with no network. No user/tenant data was sent to a model during development.
- Supported endpoints cover the most common protocol families but **not** every provider or endpoint. Custom PDF models without OpenAI Responses must get a documented adapter or future page-image conversion; do not assume Chat Completions vision accepts arbitrary PDF files.
- High-quality reading of handwriting, tiny or badly printed characters **is not guaranteed**, even if the model returns confident-looking text. Each output is untrusted, must be reviewed against original, and ambiguous numbers should be corrected or clearly left unreadable.
- There is no OCR benchmark yet, no field extraction/normalization/IBAN validation, no cost estimator, no image upscaling, no second interpretation, and no OCR search indexing. The review text lives only inside the Case, not exported to accounting.
- PDFs must have passed pre-upload structural inspection. The process running network-capable SDKs is currently Next.js, so moving provider calls to a dedicated no-secret worker is a later security improvement. HTTPS does not establish GDPR legality or prevent sending to the wrong configured vendor.
- Existing host-managed antivirus decision and controlled PDF parsing remain; no extra ClamAV.
- Existing global AI credentials in `Tenant` are inherited from HaVeWa; encrypted storage, rotation and least-privilege provider scopes remain for the single-PC production security review. Do not print or check real credentials into Git.
- Operational controls still required: per-tenant rate limits, model invocation billing/quotas, timeouts, data retention and deletion, safe concurrent job state/idempotency, provider data-processing agreements and full Issue #11 read-token audit.

## Verified tests and follow-up

- `src/lib/ai-document-recognition.test.ts`: provider payload routing, exact chosen model, images vs PDF, strict JSON/uncertainty contract, local loopback vs unsafe HTTP and redacted provider failures.
- `scripts/e7-recognition-db-smoke.ts`: synthetic-only DB preflight and generated PDF, refused missing consent, mock provider receives exact bytes+selected model, recognition persists as DRAFT tied to original, duplicate denied, corrected REVIEWED copy with actor audit; original Case proposal not changed, cleanup restores settings and removes all fixtures. No paid API request.
- Previous E3/E4/E5/E6 unit/build/Chrome and backup+restore smoke must continue to pass. E7 migrates synthetic localhost DB only (`66` total migrations), not real users.
- Next step after separate security review: benchmark selected real low-cost vision models on **synthetic or explicitly authorized anonymized** handwritten/bad German scans; compare error/abstention rather than apparent fluency.
