import { createCase, propose, revise, submitForReview, approve, prepareApprovedHandoff } from "./engine.mjs";

const owner = { id: "owner-demo", role: "owner", tenantId: "WEG-DEMO" };
const agent = { id: "ai-demo", role: "agent", tenantId: "WEG-DEMO" };
const manager = { id: "manager-demo", role: "manager", tenantId: "WEG-DEMO" };

let record = createCase({
  id: "demo-case-0001",
  tenantId: "WEG-DEMO",
  propertyId: "fictional-building-6-units",
  summary: "Possible leak in the basement (mock only)",
  source: {
    ref: "photo:synthetic-example",
    type: "photo",
    description: "Artificial test artifact; no image is analyzed"
  }
}, owner);

record = propose(record, {
  id: "draft-handwerker-request",
  type: "contractor_inquiry",
  title: "Anfrage: mögliche Undichtigkeit im Keller",
  body: "Sehr geehrte Damen und Herren, wir bitten um ein Angebot zur Besichtigung.",
  sourceRefs: ["photo:synthetic-example"]
}, agent);

record = revise(record, "draft-handwerker-request", {
  body: "Sehr geehrte Damen und Herren, bitte bieten Sie zunächst einen Besichtigungstermin an. Es wurde noch kein Auftrag erteilt."
}, owner);
record = submitForReview(record, "draft-handwerker-request", owner);
record = approve(record, "draft-handwerker-request", manager);

console.log(JSON.stringify({
  packet: prepareApprovedHandoff(record, "draft-handwerker-request", manager),
  audit: record.events,
  warning: "MOCK ONLY. No AI, OCR, contractor search, email or payment was executed."
}, null, 2));
