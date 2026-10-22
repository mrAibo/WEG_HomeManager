# Contractor discovery / MyHammer / tender handoff

**Reviewed:** 2026-10-22. Product requirement: AI may research and draft; no autonomous posting, contract award or purchase without authorized human.

## MyHammer: worth supporting
Official: https://www.my-hammer.de/auftraggeber-info/so-funktionierts
Official posting route: https://www.my-hammer.de/finde-einen-service
Support: https://support.my-hammer.de/s/article/Kostet-es-etwas-einen-Auftrag-zu-erstellen
AGB (February 2026): https://www.my-hammer.de/allgemeine-geschaefts-bedingungen

### Verified current behavior
- Customer posts a **genuine job request** with description and photos; contractors respond with expressions of interest and potentially quotes.
- MyHammer states use is free for the Auftraggeber; providers pay fees on confirmed lead contacts.
- Customer reviews profiles, qualifications, price/scope and real bids; recipient contacts are mediated.
- It is better described as a **lead / quote marketplace**, not a timed reverse auction or guaranteed lowest-price procurement.
- AGB require genuine jobs, forbid publishing another party's job, duplicate active postings of the same job, and require customers to check contractor qualifications and offers before award.
- AGB restrict gathering platform data with scraping/crawling and unauthorized building of a database from user-provided platform data. No generally available sanctioned API for automatic client job postings was verified in this review.
- Professional WEG representative must ensure proper authorization before public posting and especially before award/contract; do not confuse a private owner's ability to report a defect with authority to hire on behalf of WEG.

### MVP policy: assisted, user-controlled manual handoff
1. Case (photos/measurements/approximate location), evidence and problem summary.
2. AI generates **editable, truthful** German `Leistungsbeschreibung` and makes missing details visible.
3. Redact occupant data, access details, private photos and owner identifiers before public posting.
4. Human verifies real need, posting authority and safe privacy scope; confirms final advert text.
5. Display **"Text kopieren"**, **"Fotos vorbereiten"**, and **"Bei MyHammer öffnen"**. User manually creates/posts the advertisement in the official portal.
6. Record only our job reference, selected provider link/identifier when lawfully available, posting date/status and consented user-provided replies/quotes; avoid unauthorized scraping/extraction.
7. AI helps compare **actual written quotations** with gross total, scope, exclusions, response and insurance/licensing evidence.
8. Authorized manager/WEG decides. Actual award/email dispatch is controlled and audited.

### Alternatives
- https://www.blauarbeit.de/ : Auftraggeber use is free under currently published conditions; consider as a second manually-assisted route.
- https://handwerk.check24.de/craftsmen/dienstleister/handwerker : CHECK24 Profis is a lead marketplace for providers; verify current client-side job submission and API support separately before claiming direct integration.
- Existing trusted local contractor list and an ordinary approved email RFQ remain essential, especially for urgent/specialist work.

## Procurement UX idea
```
Case: Treppenhausleuchte defekt
AI draft: "Bitte um Angebot für Prüfung und Instandsetzung..."
[Bearbeiten] [Kopieren] [MyHammer öffnen] [Alternativ per E-Mail anfragen]
------------------------------------------------------------
Angebot A: actual documented price/term | Qualifikation | Quelle
Angebot B: actual documented price/term | Qualifikation | Quelle
[Vergleich ansehen] [Vorlage zur Beauftragung] (authorized approval required)
```

## Technical adapter contract (planned, not implemented)
- `createJobDraft(caseId) -> editable user document`
- `prepareMarketplaceHandoff(provider, approvedVersion) -> copy/open only`
- `recordHumanPublication(jobId, externalLink?, date) -> audited metadata`
- `importUserProvidedQuote(file) -> document evidence`
- `compareQuotes(quoteRefs[]) -> explainable comparison`

Do **not** implement an unsupported `postJob()` to MyHammer, headless form automation, login/password bot, scraping, or anything circumventing their terms.
Later investigate a **formal partnership/supported API** with the provider and legal approval if justified by real demand. Provider responses/availability must never be invented.

## Emergency handling
For urgent electricity, gas, water or structural safety risks, show immediate safe contact/emergency guidance and known contracted emergency services. A marketplace bid process is usually unsuitable for time-critical safety measures.

## Source note
These are current service claims/published rules, not proof of platform suitability for every trade or city. Recheck public policies and accepted job types before release.
