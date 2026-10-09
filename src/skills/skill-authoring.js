export const AUTHORING_PIPELINE = [
  "scenario",
  "baseline",
  "success_criteria",
  "write_skill",
  "verify",
  "register",
  "measure",
  "validate",
];

export const EXCLUSIONS = ["one_off", "mechanical", "project_specific", "duplicate"];

export function classifyArtifact(candidate = {}) {
  const hay = [candidate.name, candidate.description, candidate.purpose, ...(candidate.triggers || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (candidate.steps || /\b(step|paso|->|then|first|primero)\b/.test(hay)) return "workflow";
  if (candidate.deterministic || /\b(always|never|must|regla|rule)\b/.test(hay)) return "constraint";
  if (candidate.referenceOnly || /\b(reference|doc|api|schema)\b/.test(hay)) return "reference";
  return "skill";
}

export function validateAuthoringRecord(record = {}) {
  const errors = [];
  if (!record.name) errors.push("skill.name required");
  if (!record.scenario || !record.scenario.input) errors.push("scenario.input required");
  if (!record.scenario || !record.scenario.expected_behavior) errors.push("scenario.expected_behavior required");
  if (!record.baseline || !record.baseline.observed_behavior) errors.push("baseline.observed_behavior required (capture BEFORE writing)");
  if (!record.verification || !record.verification.evidence) errors.push("verification.evidence required");
  if (!record.verification || !record.verification.result) errors.push("verification.result required");
  return { ok: errors.length === 0, errors };
}

function tokenize(text) {
  return new Set(String(text || "").toLowerCase().match(/[a-z0-9]+/g) || []);
}

function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function detectDuplication(candidate = {}, registry = [], { threshold = 0.6 } = {}) {
  const candText = [candidate.name, candidate.description, ...(candidate.triggers || [])].filter(Boolean).join(" ");
  const matches = [];
  for (const skill of registry) {
    const text = [skill.name, skill.description, ...(skill.triggers || [])].filter(Boolean).join(" ");
    const score = jaccard(candText, text);
    if (score >= threshold) matches.push({ name: skill.name, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return { duplicate: matches.length > 0, matches, threshold };
}

export function checkExclusions(candidate = {}) {
  if (candidate.oneOff) return { ok: false, reason: "one_off" };
  if (candidate.mechanical || candidate.deterministicSteps) return { ok: false, reason: "mechanical" };
  if (candidate.projectSpecific) return { ok: false, reason: "project_specific" };
  if (candidate.duplicate) return { ok: false, reason: "duplicate" };
  return { ok: true, reason: null };
}
