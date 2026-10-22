// Experimental pure workflow engine. No filesystem/network/LLM/bank/email access.
const SOURCE_TYPES = new Set(["photo", "pdf", "email", "text", "voice"]);
const PROPOSAL_TYPES = new Set([
  "maintenance_ticket", "contractor_inquiry", "email_draft",
  "invoice_classification", "resolution_draft", "accounting_draft"
]);
const HUMAN_ROLES = new Set(["owner", "beirat", "manager"]);
const PRIVILEGED_ROLES = new Set(["manager"]);

export class WorkflowError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkflowError";
  }
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new WorkflowError(`${name} must be a nonempty string`);
  }
  return value.trim();
}

function checkActor(actor, tenantId) {
  if (!actor || typeof actor !== "object") {
    throw new WorkflowError("actor required");
  }
  required(actor.id, "actor.id");
  required(actor.role, "actor.role");
  if (actor.tenantId !== tenantId) {
    throw new WorkflowError("cross-tenant access denied");
  }
}

function event(record, actor, action, details = {}) {
  record.events.push({
    sequence: record.events.length + 1,
    action,
    actorId: actor.id,
    actorRole: actor.role,
    details
  });
}

function clone(record) {
  return structuredClone(record);
}

function proposalById(record, proposalId) {
  const proposal = record.proposals.find((p) => p.id === proposalId);
  if (!proposal) throw new WorkflowError("proposal not found");
  return proposal;
}

function editableBy(actor, record) {
  return actor.role === "manager" || actor.role === "beirat" ||
    (actor.role === "owner" && actor.id === record.createdBy);
}

export function createCase({ id, tenantId, propertyId, summary, source }, actor) {
  const caseId = required(id, "case.id");
  const scope = required(tenantId, "tenantId");
  checkActor(actor, scope);
  if (!HUMAN_ROLES.has(actor.role)) throw new WorkflowError("human reporter required");
  if (!source || !SOURCE_TYPES.has(source.type)) {
    throw new WorkflowError("unsupported evidence source type");
  }
  const ref = required(source.ref, "source.ref");
  const record = {
    id: caseId,
    tenantId: scope,
    propertyId: required(propertyId, "propertyId"),
    summary: required(summary, "summary"),
    createdBy: actor.id,
    evidence: [{ ref, type: source.type, description: source.description ?? "" }],
    proposals: [],
    events: []
  };
  event(record, actor, "case.created", { sourceRef: ref, sourceType: source.type });
  return record;
}

export function addEvidence(record, source, actor) {
  checkActor(actor, record.tenantId);
  if (!editableBy(actor, record)) throw new WorkflowError("not allowed to edit case");
  if (!source || !SOURCE_TYPES.has(source.type)) {
    throw new WorkflowError("unsupported evidence source type");
  }
  const ref = required(source.ref, "source.ref");
  if (record.evidence.some((e) => e.ref === ref)) {
    throw new WorkflowError("duplicate evidence reference");
  }
  const next = clone(record);
  next.evidence.push({ ref, type: source.type, description: source.description ?? "" });
  event(next, actor, "evidence.added", { sourceRef: ref });
  return next;
}

export function propose(record, draft, actor) {
  checkActor(actor, record.tenantId);
  if (actor.role !== "agent" && actor.role !== "manager") {
    throw new WorkflowError("only agent or manager may propose");
  }
  const id = required(draft?.id, "proposal.id");
  if (record.proposals.some((p) => p.id === id)) {
    throw new WorkflowError("duplicate proposal id");
  }
  if (!PROPOSAL_TYPES.has(draft.type)) {
    throw new WorkflowError("unsupported proposal type; direct payments are prohibited");
  }
  const refs = draft.sourceRefs;
  if (!Array.isArray(refs) || refs.length === 0 ||
      refs.some((ref) => !record.evidence.some((e) => e.ref === ref))) {
    throw new WorkflowError("proposal requires existing source evidence");
  }
  const next = clone(record);
  next.proposals.push({
    id, type: draft.type, version: 1,
    title: required(draft.title, "draft.title"),
    body: required(draft.body, "draft.body"),
    sourceRefs: [...new Set(refs)],
    status: "draft",
    approval: null
  });
  event(next, actor, "proposal.created", { proposalId: id, type: draft.type });
  return next;
}

export function revise(record, proposalId, changes, actor) {
  checkActor(actor, record.tenantId);
  if (!editableBy(actor, record)) throw new WorkflowError("not allowed to revise");
  const next = clone(record);
  const p = proposalById(next, proposalId);
  if (p.status === "rejected") throw new WorkflowError("rejected proposal cannot be revised");
  if (!changes || (!("title" in changes) && !("body" in changes))) {
    throw new WorkflowError("title or body change required");
  }
  if ("title" in changes) p.title = required(changes.title, "title");
  if ("body" in changes) p.body = required(changes.body, "body");
  p.version++;
  p.status = "draft";
  p.approval = null; // Every change invalidates previous approval.
  event(next, actor, "proposal.revised", { proposalId, version: p.version });
  return next;
}

export function submitForReview(record, proposalId, actor) {
  checkActor(actor, record.tenantId);
  if (!editableBy(actor, record)) throw new WorkflowError("not allowed to submit");
  const next = clone(record);
  const p = proposalById(next, proposalId);
  if (p.status !== "draft") throw new WorkflowError("proposal must be a draft");
  p.status = "in_review";
  event(next, actor, "proposal.submitted", { proposalId, version: p.version });
  return next;
}

export function approve(record, proposalId, actor) {
  checkActor(actor, record.tenantId);
  if (!PRIVILEGED_ROLES.has(actor.role)) {
    throw new WorkflowError("only authorized human manager may approve workflow handoff");
  }
  const next = clone(record);
  const p = proposalById(next, proposalId);
  if (p.status !== "in_review") throw new WorkflowError("proposal not in review");
  p.status = "approved";
  p.approval = { actorId: actor.id, role: actor.role, version: p.version };
  event(next, actor, "proposal.approved", { proposalId, version: p.version });
  return next;
}

export function reject(record, proposalId, reason, actor) {
  checkActor(actor, record.tenantId);
  if (!PRIVILEGED_ROLES.has(actor.role)) throw new WorkflowError("only manager may reject");
  const next = clone(record);
  const p = proposalById(next, proposalId);
  if (p.status !== "in_review") throw new WorkflowError("proposal not in review");
  p.status = "rejected";
  p.approval = null;
  event(next, actor, "proposal.rejected", { proposalId, reason: required(reason, "reason") });
  return next;
}

export function prepareApprovedHandoff(record, proposalId, actor) {
  checkActor(actor, record.tenantId);
  if (!PRIVILEGED_ROLES.has(actor.role)) throw new WorkflowError("handoff requires manager");
  const p = proposalById(record, proposalId);
  if (p.status !== "approved" || !p.approval ||
      p.approval.version !== p.version) {
    throw new WorkflowError("current proposal version is not approved");
  }
  return {
    caseId: record.id, tenantId: record.tenantId, propertyId: record.propertyId,
    proposalId: p.id, type: p.type, version: p.version,
    title: p.title, body: p.body, evidenceRefs: [...p.sourceRefs],
    approvedBy: p.approval.actorId
  };
}

// IMPORTANT: There is no send, bank, contractor booking, or remote execution function.
// Production execution needs a persistent, idempotent, policy-enforced adapter.
