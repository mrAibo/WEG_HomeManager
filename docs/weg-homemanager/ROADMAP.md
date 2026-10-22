# Roadmap — AI-first WEG HomeManager

Do not implement user-facing agents until the foundation can enforce manual edits and authorization.

## G0 — Ingest HaVeWa as an identifiable upstream baseline
- [ ] Import code into `mrAibo/WEG_HomeManager`; current repo is NOT a GitHub fork.
- [ ] Preserve original LICENSE, LICENSING, notices, history/provenance where possible.
- [ ] Record upstream commit hash, sync strategy and product licensing plan.
- [ ] Pin dependencies, run upstream tests/lint/build and inspect open security issues.
- [ ] Map existing AI, MCP, tickets, docs, WEG accounting and roles; do not duplicate them.

**Gate:** reproducible baseline, no regressions, traceable upstream.

## G1 — Case engine + review workspace (first feature)
- [ ] Persistent Case/Evidence/Proposal/Approval/Audit models and migrations.
- [ ] Image/PDF/upload intake, safe storage and provenance.
- [ ] User-editable extracted data, proposed steps and document drafts.
- [ ] Server-side approval invalidation on edits and idempotent execution boundary.
- [ ] Tests for cross-tenant leaks, prompt injection, forbidden writes and retries.
- [ ] Demo: photo → maintenance ticket draft → editable contractor inquiry → review.

**Gate:** one case end-to-end in local sandbox, **no automatic external writes**.

## G2 — Handwerker assistant
- [ ] Live, sourced contractor discovery (location, trade, credentials, reviews where available).
- [ ] Candidate shortlist with evidence, real provider links and no invented prices/times.
- [ ] Draft/compare quote requests and actual incoming bids.
- [ ] Approval-controlled send/order; contractor response and deadline tracking.

## G3 — Invoice/documents agent
- [ ] OCR and document classification (scans/photos/PDFs, optionally HEIC).
- [ ] Extract amount, vendor, date, IBAN, due date with confidence and source location.
- [ ] Identify duplicates, suspected bank detail changes and missing approvals.
- [ ] Link invoice -> approved quote -> work ticket -> draft accounting entry.
- [ ] Human corrections, reconciled bookkeeping and export.

## G4 — WEG decisions / reporting
- [ ] Versioned legal rules and Gemeinschaftsordnung overrides reviewed by specialist.
- [ ] Meeting agenda, notices, minutes and resolution drafts.
- [ ] Deterministic allocation, payment, reserves and voting with golden test fixtures.
- [ ] Annual plan and statement comparisons + discrepancy explanations.

## G5 — Productization
- [ ] Mobile-friendly capture and accessible German interface.
- [ ] Self-managed and professional-manager modes.
- [ ] Multi-property, multi-tenant RBAC and data portability.
- [ ] Plugin/AI provider abstraction, performance budgets and observability.
- [ ] Real-user pilot only after independent security/legal/accounting checks.

## Synthetic test plan
Use reproducible seeded fixtures: 6, 12, 50 units; multiple owners per unit; differing MEA; invoices, duplicate bank transactions, urgent damage, hostile PDF text, changed drafts, declined approvals and retry storms.
Expected balances and voting outcomes are exact fixtures, not generated LLM assertions.
