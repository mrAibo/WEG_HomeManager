import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkflowError, createCase, addEvidence, propose, revise,
  submitForReview, approve, reject, prepareApprovedHandoff
} from "./engine.mjs";

const owner = { id: "fictional-owner", role: "owner", tenantId: "demo-weg" };
const manager = { id: "fictional-manager", role: "manager", tenantId: "demo-weg" };
const agent = { id: "synthetic-agent", role: "agent", tenantId: "demo-weg" };
const outsider = { id: "outsider", role: "manager", tenantId: "another-weg" };

function seededCase() {
  return createCase({
    id: "case-001",
    tenantId: "demo-weg",
    propertyId: "synthetic-property",
    summary: "Water near cellar pipe (hypothetical)",
    source: { type: "photo", ref: "photo:fake-sha256", description: "Mock photo" }
  }, owner);
}
function draft() {
  return {
    id: "draft-001",
    type: "contractor_inquiry",
    title: "Anfrage wegen möglichem Wasserschaden",
    body: "Sehr geehrte Damen und Herren, bitte prüfen Sie...",
    sourceRefs: ["photo:fake-sha256"]
  };
}

test("AI can prepare but not approve a contractor inquiry", () => {
  const start = seededCase();
  const proposed = propose(start, draft(), agent);
  assert.equal(start.proposals.length, 0, "input remains unchanged");
  const queued = submitForReview(proposed, "draft-001", owner);
  assert.throws(() => approve(queued, "draft-001", agent), WorkflowError);
  assert.throws(() => prepareApprovedHandoff(queued, "draft-001", manager), WorkflowError);
  const approved = approve(queued, "draft-001", manager);
  const packet = prepareApprovedHandoff(approved, "draft-001", manager);
  assert.equal(packet.version, 1);
  assert.equal(packet.evidenceRefs[0], "photo:fake-sha256");
  assert.equal(packet.approvedBy, manager.id);
});

test("human edit invalidates an old approval", () => {
  let rec = propose(seededCase(), draft(), agent);
  rec = submitForReview(rec, "draft-001", owner);
  rec = approve(rec, "draft-001", manager);
  const changed = revise(rec, "draft-001", { body: "Bitte zunächst nur besichtigen." }, owner);
  assert.equal(changed.proposals[0].version, 2);
  assert.equal(changed.proposals[0].approval, null);
  assert.equal(changed.proposals[0].status, "draft");
  assert.throws(() => prepareApprovedHandoff(changed, "draft-001", manager), WorkflowError);
});

test("fabricated or missing evidence cannot support a proposal", () => {
  assert.throws(() => propose(seededCase(), { ...draft(), sourceRefs: ["missing"] }, agent), WorkflowError);
  assert.throws(() => propose(seededCase(), { ...draft(), sourceRefs: [] }, agent), WorkflowError);
});

test("tenant boundaries are mandatory", () => {
  assert.throws(() => revise(seededCase(), "draft-001", { body: "changed" }, outsider), WorkflowError);
  assert.throws(() => propose(seededCase(), draft(), { ...agent, tenantId: "other" }), WorkflowError);
});

test("direct bank-transfer proposal types are unsupported", () => {
  assert.throws(() => propose(seededCase(), { ...draft(), type: "bank_transfer" }, agent), WorkflowError);
});

test("rejected work does not become executable", () => {
  let rec = propose(seededCase(), draft(), agent);
  rec = submitForReview(rec, "draft-001", owner);
  rec = reject(rec, "draft-001", "Needs an on-site survey", manager);
  assert.throws(() => prepareApprovedHandoff(rec, "draft-001", manager), WorkflowError);
});

test("evidence has a unique stable reference", () => {
  let rec = seededCase();
  rec = addEvidence(rec, { type: "pdf", ref: "pdf:mock-inspection" }, owner);
  assert.equal(rec.evidence.length, 2);
  assert.throws(() => addEvidence(rec, { type: "pdf", ref: "pdf:mock-inspection" }, owner), WorkflowError);
});

test("approval records ordered actor-stamped audit events", () => {
  let rec = propose(seededCase(), draft(), agent);
  rec = submitForReview(rec, "draft-001", owner);
  rec = approve(rec, "draft-001", manager);
  assert.deepEqual(rec.events.map((e) => e.sequence), [1, 2, 3, 4]);
  assert.equal(rec.events[3].actorRole, "manager");
});
