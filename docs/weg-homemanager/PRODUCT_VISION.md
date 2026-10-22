# Product vision — AI-first WEG HomeManager

## Mission
Remove administrative work, not human agency. Users describe a task in natural language or upload a document/photo. The system produces a **reviewable work package** with evidence, risk classification, next steps and editable outputs. It never represents an AI suggestion as a binding decision.

## Target roles
- **WEG administrator:** accountable for operational decisions, finances and contacts.
- **Verwaltungsbeirat:** authorized review and oversight, not automatically a legal signatory.
- **Owner:** ask about own permitted information, report defects, check decisions and documents.
- **External contractor:** receives only specifically released requests/documents.

Authorization must follow actual appointment, applicable WEG rules and defined delegation; a software role alone does not create legal authority.

## AI-first interaction
One primary field: "Was muss erledigt werden?" accompanied by **photo / scan / document / voice / email** entry points.
Each request opens a **Case**. Cases contain source evidence, facts, missing information, proposed steps, generated artifacts, approval requirements, status and audit history.

### Core journeys
1. **Photo of a defect:** probable category and urgency; safety-first handling; draft ticket; shortlist verified trades; editable inquiry; compare received real bids; approve order; follow completion.
2. **Scanned invoice:** OCR with page/field provenance and confidence; supplier/amount/IBAN checks; duplicate detection; correlate with order and approved work; propose bookkeeping; manual correction; explicit payment approval.
3. **Letter from authority/insurer:** classify and surface verified deadlines; draft response with citations; remind user; never invent legal certainty.
4. **WEG meeting:** proposed agenda, invitation, draft resolution and minutes; deterministic voting calculation according to reviewed applicable rules; document approval and export.
5. **Natural-language question:** search only documents the requester may see, return sources and explicit unknowns. No claim of live contractor availability without a real source.
6. **Annual reporting:** deterministic reconciliation and allocation with PDF drafts; AI explains discrepancies, not the final arithmetic.

## Workflow contract
For every AI-generated claim, store: source reference, origin (source vs interpretation), confidence/uncertainty, user-visible explanation, and responsible reviewer. Every action has an auditable, editable preview before it is committed.

## Product constraints
- German WEG focus; multilingual UI later.
- Small WEG (6 units) as first test, not hard-coded maximum.
- Mobile-first capture and desktop-ready back office.
- Operation possible with no configured LLM; deterministic features must remain functional.
- Never bypass emergency guidance due to routine approval workflows.
- Respect data minimization, retention, subject access and tenant isolation.

## North-star quality criteria
- Photo/scan -> editable case with citations and clear next action.
- User can correct extracted values and AI text **without losing the original source**.
- No outbound email, order, financial transaction or binding legal act without appropriate human authorization.
- Every generated financial total independently reconciles to source records.
- An external WEG administrator can take over via documented data export.
