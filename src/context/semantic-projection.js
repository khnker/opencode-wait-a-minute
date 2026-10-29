/**
 * Semantic projection — compaction reads structured state, not the transcript.
 *
 * Pure by design: no disk I/O, no clock, no new dependencies. Callers pass the
 * already-loaded ledger/base so a missing source degrades to the legacy brief.
 */
import { projectExecution } from "../state/execution-ledger.js";
import { REQUIREMENT_STATES } from "../verification/verification-model.js";

const CAPS = Object.freeze({
  constraints: 6,
  requirements: 10,
  pending: 10,
  conflicts: 8,
  decisions: 8,
  evidence: 10,
  openItems: 12,
});

const LIVE_DECISION_STATUSES = new Set(["accepted", "approved"]);
const MIN_ID_REF = 4;
const MIN_TITLE_REF = 8;
const DECISION_CLIP = 120;
const SCOPED_ID = /(?:^|[-_])(?:task|ses)[-_]/i;
const BASE_REF_SAMPLE = 4;

function normalizeRef(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function decisionRecency(decision) {
  const match = /(\d{10,})\s*$/.exec(String(decision?.id || ""));
  return match ? Number(match[1]) : 0;
}

/**
 * Decisions are projected when they are task-linked. Ids carry their scope
 * (`task-…`, `ses-…`); an id scoped to another task/session is retrievable
 * context, not compaction context. Unscoped ids are project-wide decisions.
 */
function decisionBelongsToTask(decision, { idRefs, titleRefs }) {
  const id = String(decision?.id || "");
  const haystack = normalizeRef(`${id} ${decisionText(decision)}`);
  if (idRefs.some((ref) => haystack.includes(ref))) return true;
  if (!SCOPED_ID.test(id)) return true;
  return titleRefs.some((ref) => haystack.includes(ref));
}

/** Repeated approvals of the same choice add no continuity value. */
function dedupeDecisions(decisions) {
  const seen = new Set();
  return decisions.filter((decision) => {
    const key = normalizeRef(decisionText(decision));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function taskRefsFor(taskId, taskState) {
  const requirements = Array.isArray(taskState?.requirements) ? taskState.requirements : [];
  const idRefs = uniqueSorted(
    [taskId, ...requirements.map((req) => req?.id)]
      .map(normalizeRef)
      .filter((ref) => ref.length >= MIN_ID_REF),
  );
  const titleRefs = uniqueSorted(
    requirements
      .map((req) => normalizeRef(req?.title))
      .filter((ref) => ref.length >= MIN_TITLE_REF),
  );
  return { idRefs, titleRefs };
}

function constraintText(constraint) {
  if (typeof constraint === "string") return constraint;
  return constraint?.text || constraint?.constraint || constraint?.description || constraint?.id || "";
}

function decisionText(decision) {
  if (typeof decision === "string") return decision;
  return decision?.decision || decision?.text || "";
}

function refOf(item) {
  if (typeof item === "string") return item;
  return item?.id || item?.ref || item?.path || "";
}

function take(list, cap, omitted) {
  const items = Array.isArray(list) ? list : [];
  for (const item of items.slice(cap)) omitted.push(refOf(item));
  return items.slice(0, cap);
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))].sort();
}

export function buildSemanticProjection({
  taskId = "unknown",
  taskState = {},
  decisions = [],
  ledger = null,
  base = null,
  constraints = [],
} = {}) {
  const contract = taskState.contract || {};
  const requirements = Array.isArray(taskState.requirements) ? taskState.requirements : [];
  const objective =
    contract.objective ||
    contract.goal ||
    taskState.currentGoal ||
    requirements[0]?.title ||
    taskState.lastAction ||
    "unknown";

  const exec = ledger
    ? projectExecution(ledger)
    : { requirements: [], pendingObligations: [], conflicts: [] };
  const omitted = [];

  const constraintList = uniqueSorted(
    (Array.isArray(constraints) && constraints.length ? constraints : contract.constraints || [])
      .map(constraintText),
  );

  // Continuity beats volume: obligations/conflicts, then unfinished work, then evidence, then the rest.
  const referenced = new Set([
    ...(exec.pendingObligations || []).map((item) => item.requirementId),
    ...(exec.conflicts || []).map((item) => item.requirementId),
  ]);
  const requirementRank = (req) => {
    if (referenced.has(req.id)) return 0;
    if (req.status !== REQUIREMENT_STATES.VERIFIED) return 1;
    if (req.evidenceRefs.length > 0) return 2;
    return 3;
  };
  const executionRequirements = take(
    (exec.requirements || [])
      .map((req) => ({
        id: req.id,
        claim: req.claim || "",
        status: req.status || "unknown",
        evidenceRefs: uniqueSorted(req.evidenceRefs || []),
      }))
      .sort((a, b) => requirementRank(a) - requirementRank(b) || String(a.id).localeCompare(String(b.id))),
    CAPS.requirements,
    omitted,
  ).sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const pendingAll = (exec.pendingObligations || []).map((item) => ({
    requirementId: item.requirementId || "?",
    status: item.status || "unknown",
    reason: item.reason || "",
    nextStates: uniqueSorted(item.nextStates || []),
  }));
  const pending = take(pendingAll, CAPS.pending, omitted);

  const conflicts = take(
    (exec.conflicts || []).map((item) => ({
      requirementId: item.requirementId || "?",
      ref: item.ref || "",
      note: item.note || "",
    })),
    CAPS.conflicts,
    omitted,
  );

  const taskRefs = taskRefsFor(taskId, taskState);
  const liveDecisions = dedupeDecisions(
    (Array.isArray(decisions) ? decisions : [])
      .filter((decision) => LIVE_DECISION_STATUSES.has(String(decision?.status || "").toLowerCase()))
      .filter((decision) => decisionBelongsToTask(decision, taskRefs))
      .sort(
        (a, b) =>
          decisionRecency(b) - decisionRecency(a) ||
          String(a?.id || "").localeCompare(String(b?.id || "")),
      ),
  );
  const projectedDecisions = take(
    liveDecisions.map((decision) => ({
      id: decision?.id || null,
      text: decisionText(decision),
      status: String(decision?.status || "").toLowerCase(),
    })),
    CAPS.decisions,
    omitted,
  );

  const evidenceRefs = uniqueSorted([
    ...executionRequirements.flatMap((req) => req.evidenceRefs),
    ...conflicts.map((conflict) => conflict.ref),
    ...(Array.isArray(taskState.evidence) ? taskState.evidence.map(refOf) : []),
  ]);

  const blockingUnknowns = (contract.unknowns || [])
    .filter((unknown) => unknown?.status === "blocking")
    .map((unknown) => ({
      kind: "unknown",
      ref: unknown.id || "?",
      text: unknown.question || unknown.text || "",
    }));

  const openItems = take(
    [
      ...pendingAll.map((item) => ({
        kind: "obligation",
        ref: item.requirementId,
        text: `${item.reason || "not verified"} (${item.status} -> [${item.nextStates.join(", ")}])`,
      })),
      ...(exec.conflicts || []).map((item) => ({
        kind: "conflict",
        ref: item.requirementId || "?",
        text: [item.ref, item.note].filter(Boolean).join(": ") || "unresolved evidence conflict",
      })),
      ...blockingUnknowns,
    ],
    CAPS.openItems,
    omitted,
  );

  const firstPending = pendingAll[0];
  const nextObligation = firstPending
    ? `${firstPending.requirementId}: ${firstPending.reason || "not verified"} (${firstPending.status} -> [${firstPending.nextStates.join(", ")}])`
    : taskState.nextAction || contract.nextAction || null;

  const projectedEvidence = take(evidenceRefs, CAPS.evidence, omitted);
  const baseEntries = Array.isArray(base?.entries) ? base.entries : [];
  const baseRefs = uniqueSorted(baseEntries.map(refOf));
  const retrievableRefs = uniqueSorted([...baseRefs, ...omitted]);

  return {
    taskId,
    objective,
    constraints: constraintList.slice(0, CAPS.constraints),
    execution: { requirements: executionRequirements, pending, conflicts },
    decisions: projectedDecisions,
    evidenceRefs: projectedEvidence,
    openItems,
    nextObligation,
    baseRefs,
    retrievableRefs,
  };
}

export function renderSemanticProjection(projection, { maxChars = 4000, truncate } = {}) {
  const clip =
    typeof truncate === "function"
      ? truncate
      : (text, max = 160) => {
          const value = String(text || "").replace(/\s+/g, " ").trim();
          return value.length > max ? `${value.slice(0, max - 3)}...` : value;
        };
  const value = projection || {};
  const lines = [
    "[wam semantic projection]",
    `objective: ${clip(value.objective || "unknown", 220)}`,
  ];

  const section = (heading, items, render) => {
    if (!items || items.length === 0) return;
    lines.push(`${heading}:`);
    for (const item of items) lines.push(`- ${render(item)}`);
  };

  section("constraints", value.constraints, (item) => clip(item, 140));

  const execution = value.execution || {};
  section(
    "execution state",
    [
      ...(execution.requirements || []).map((req) => `req ${req.id}: ${req.status}`),
      ...(execution.conflicts || []).map(
        (item) => `conflict ${item.requirementId}: ${[item.ref, item.note].filter(Boolean).join(": ") || "unresolved"}`,
      ),
    ],
    (line) => clip(line, 200),
  );

  section("live decisions", value.decisions, (decision) => clip(decision?.text || "", DECISION_CLIP));

  section("evidence", value.evidenceRefs, (ref) => clip(ref, 180));

  section("open items", value.openItems, (item) => `${item.kind} ${item.ref}: ${clip(item.text || "", 160)}`);

  lines.push(`next obligation: ${clip(value.nextObligation || "none", 220)}`);

  const refs = Array.isArray(value.retrievableRefs) ? value.retrievableRefs : [];
  const baseRefs = Array.isArray(value.baseRefs) ? value.baseRefs : [];
  const sample = baseRefs.length ? `, e.g. ${clip(baseRefs.slice(0, BASE_REF_SAMPLE).join(", "), 140)}` : "";
  lines.push(`omitted details (retrievable): ${refs.length ? `${refs.length} ref(s)${sample}` : "none"}`);

  return lines.join("\n").slice(0, maxChars);
}
