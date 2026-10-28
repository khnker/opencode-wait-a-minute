export const OBSERVATION_SCHEMA_VERSION = 1;

export const DIALOGUE_INTENTS = Object.freeze({
  PROVIDE_REQUIREMENT: "PROVIDE_REQUIREMENT",
  DEFINE: "DEFINE",
  ADD_CONSTRAINT: "ADD_CONSTRAINT",
  ADD_ACCEPTANCE_CRITERION: "ADD_ACCEPTANCE_CRITERION",
  CLARIFY: "CLARIFY",
  ANSWER: "ANSWER",
  CORRECT: "CORRECT",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  EXECUTE: "EXECUTE",
  VERIFY: "VERIFY",
  CLAIM_DONE: "CLAIM_DONE",
  META: "META",
  CANCEL: "CANCEL",
  RESUME: "RESUME",
  UNKNOWN: "UNKNOWN",
});

export const INTENT_VALUES = new Set(Object.values(DIALOGUE_INTENTS));

export const CONTRIBUTION_KINDS = Object.freeze([
  "goal",
  "requirement",
  "constraint",
  "acceptance_criterion",
  "correction",
  "evidence",
  "question",
  "preference",
  "non_goal",
]);

export const CLAIM_KINDS = Object.freeze([
  "completion",
  "test_pass",
  "manual_verification",
  "artifact",
]);

export const SPEECH_ACTS = Object.freeze([
  "request",
  "question",
  "assertion",
  "confirmation",
  "rejection",
  "command",
]);

export const POLARITIES = Object.freeze(["affirmative", "negative", "mixed"]);
export const AMBIGUITY_LEVELS = Object.freeze(["low", "medium", "high"]);
export const RISK_FLAGS = Object.freeze([
  "destructive",
  "permission",
  "secret",
  "external_side_effect",
]);

const MAX_CONTRIBUTIONS = 20;
const MAX_CLAIMS = 10;
const MAX_TEXT = 500;

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

function clampConfidence(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function cleanList(value, allowed, max) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    if (!allowed.includes(item.kind)) continue;
    const text = cleanText(item.text);
    if (!text) continue;
    const key = `${item.kind}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: item.kind,
      text,
      confidence: clampConfidence(item.confidence, 0.5),
    });
    if (out.length >= max) break;
  }
  return out;
}

export function emptyObservation(overrides = {}) {
  return {
    schema_version: OBSERVATION_SCHEMA_VERSION,
    language: "unknown",
    intent: DIALOGUE_INTENTS.UNKNOWN,
    speech_act: "assertion",
    polarity: "affirmative",
    confidence: 0,
    answers_pending_question: false,
    references_active_task: false,
    scope_change: false,
    ambiguity: "low",
    contributions: [],
    claims: [],
    risk_flags: [],
    ...overrides,
  };
}

export function normalizeObservation(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const intent = INTENT_VALUES.has(source.intent)
    ? source.intent
    : DIALOGUE_INTENTS.UNKNOWN;
  const speechAct = SPEECH_ACTS.includes(source.speech_act)
    ? source.speech_act
    : "assertion";
  const polarity = POLARITIES.includes(source.polarity)
    ? source.polarity
    : "affirmative";
  const ambiguity = AMBIGUITY_LEVELS.includes(source.ambiguity)
    ? source.ambiguity
    : "low";
  const riskFlags = Array.isArray(source.risk_flags)
    ? [...new Set(source.risk_flags.filter((f) => RISK_FLAGS.includes(f)))]
    : [];

  return {
    schema_version: OBSERVATION_SCHEMA_VERSION,
    language: cleanText(source.language) || "unknown",
    intent,
    speech_act: speechAct,
    polarity,
    confidence: clampConfidence(source.confidence, intent === DIALOGUE_INTENTS.UNKNOWN ? 0 : 0.5),
    answers_pending_question: source.answers_pending_question === true,
    references_active_task: source.references_active_task === true,
    scope_change: source.scope_change === true,
    ambiguity,
    contributions: cleanList(source.contributions, CONTRIBUTION_KINDS, MAX_CONTRIBUTIONS),
    claims: cleanList(source.claims, CLAIM_KINDS, MAX_CLAIMS),
    risk_flags: riskFlags,
  };
}

export function validateObservation(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["observation must be an object"], observation: null };
  }
  if (input.intent !== undefined && !INTENT_VALUES.has(input.intent)) {
    errors.push(`invalid intent: ${input.intent}`);
  }
  if (input.speech_act !== undefined && !SPEECH_ACTS.includes(input.speech_act)) {
    errors.push(`invalid speech_act: ${input.speech_act}`);
  }
  if (input.polarity !== undefined && !POLARITIES.includes(input.polarity)) {
    errors.push(`invalid polarity: ${input.polarity}`);
  }
  if (input.ambiguity !== undefined && !AMBIGUITY_LEVELS.includes(input.ambiguity)) {
    errors.push(`invalid ambiguity: ${input.ambiguity}`);
  }
  if (input.confidence !== undefined) {
    const c = Number(input.confidence);
    if (!Number.isFinite(c) || c < 0 || c > 1) errors.push("confidence must be 0..1");
  }
  if (input.contributions !== undefined && !Array.isArray(input.contributions)) {
    errors.push("contributions must be an array");
  }
  if (input.claims !== undefined && !Array.isArray(input.claims)) {
    errors.push("claims must be an array");
  }
  if (input.risk_flags !== undefined && !Array.isArray(input.risk_flags)) {
    errors.push("risk_flags must be an array");
  }
  return {
    valid: errors.length === 0,
    errors,
    observation: errors.length === 0 ? normalizeObservation(input) : null,
  };
}

export function mergeObservations(primary, fallback) {
  const a = normalizeObservation(primary);
  const b = normalizeObservation(fallback);
  const contributions = [...b.contributions, ...a.contributions];
  const claims = [...b.claims, ...a.claims];
  return normalizeObservation({
    ...b,
    ...a,
    intent: a.intent === DIALOGUE_INTENTS.UNKNOWN ? b.intent : a.intent,
    confidence: Math.max(a.confidence, b.confidence),
    answers_pending_question: a.answers_pending_question || b.answers_pending_question,
    references_active_task: a.references_active_task || b.references_active_task,
    scope_change: a.scope_change || b.scope_change,
    ambiguity: a.ambiguity === "high" || b.ambiguity === "high" ? "high" : a.ambiguity,
    contributions,
    claims,
    risk_flags: [...new Set([...a.risk_flags, ...b.risk_flags])],
  });
}
