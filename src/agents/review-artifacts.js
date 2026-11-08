import {
  REVIEW_ARTIFACT_LIMITS,
  RoleContractError,
} from "./role-contracts.js";

export { REVIEW_ARTIFACT_LIMITS };

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function resolveLimits({
  maxEntries = REVIEW_ARTIFACT_LIMITS.maxEntries,
  maxContentChars = REVIEW_ARTIFACT_LIMITS.maxContentChars,
} = {}) {
  const issues = [];
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
    issues.push("maxEntries must be a positive integer");
  }
  if (!Number.isInteger(maxContentChars) || maxContentChars <= 0) {
    issues.push("maxContentChars must be a positive integer");
  }
  if (issues.length) throw new RoleContractError(issues);
  return { maxEntries, maxContentChars };
}

function toArtifact(value, index, issues) {
  if (typeof value === "string") {
    const content = value.trim();
    if (content === "") {
      issues.push(`reviewArtifacts[${index}] must be a non-empty string`);
      return null;
    }
    return { ref: `artifact-${index + 1}`, content };
  }

  if (!isObject(value)) {
    issues.push(`reviewArtifacts[${index}] must be a string or object`);
    return null;
  }

  const ref = value.ref ?? value.path ?? value.id;
  if (!isNonEmptyString(ref)) {
    issues.push(`reviewArtifacts[${index}].ref must be a non-empty string`);
    return null;
  }

  const rawContent = value.content ?? value.diff ?? value.patch;
  if (typeof rawContent !== "string") {
    issues.push(`reviewArtifacts[${index}].content must be a string`);
    return null;
  }
  const content = rawContent.trim();
  if (content === "") {
    issues.push(`reviewArtifacts[${index}].content must be non-empty`);
    return null;
  }

  return { ref: ref.trim(), content };
}

export function normalizeReviewArtifacts(values, limits = {}) {
  const { maxEntries, maxContentChars } = resolveLimits(limits);
  if (!Array.isArray(values)) {
    throw new RoleContractError(["reviewArtifacts must be an array"]);
  }

  const issues = [];
  const artifacts = [];
  const seen = new Set();
  let usedChars = 0;

  for (let index = 0; index < values.length; index += 1) {
    if (artifacts.length >= maxEntries || usedChars >= maxContentChars) break;

    const entry = toArtifact(values[index], index, issues);
    if (!entry || seen.has(entry.ref)) continue;
    seen.add(entry.ref);

    const remaining = maxContentChars - usedChars;
    const content =
      entry.content.length > remaining
        ? entry.content.slice(0, remaining)
        : entry.content;
    if (content === "") break;

    artifacts.push({ ref: entry.ref, content });
    usedChars += content.length;
  }

  if (issues.length) throw new RoleContractError(issues);
  return artifacts;
}

export function assertReviewArtifacts(values, limits) {
  return normalizeReviewArtifacts(values, limits);
}

const FAILURE_MARKERS = [
  /(?:^|\n)\s*✖(?:\s|$)/,
  /(?:^|\n)\s*not ok(?:\s|$)/i,
  /(?:^|\n)\s*FAIL(?:ED)?\b/,
  /(?:^|\n)\s*AssertionError\b/,
  /\b(?:fail(?:ed|ures?)?|failing)\s*[:=]?\s*[1-9]\d*\b/i,
  /\b[1-9]\d*\s+(?:failed|failing|failures?)\b/i,
];

export function detectReviewArtifactFailure(artifacts) {
  if (!Array.isArray(artifacts)) return null;
  for (const artifact of artifacts) {
    const content = String(artifact?.content ?? "");
    if (FAILURE_MARKERS.some((pattern) => pattern.test(content))) {
      return { ref: String(artifact?.ref ?? ""), content };
    }
  }
  return null;
}
