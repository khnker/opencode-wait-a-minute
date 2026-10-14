/**
 * Frontend UX benchmark conditions and controlled variables.
 *
 * Conditions differ only by declared feature flags. Everything that must be
 * held constant (model, spec, repo snapshot, tools, constraints) lives in
 * `CONTROLLED_FACTORS` and is copied into every condition context. Any drift is
 * surfaced by `detectDeviations` and logged in the benchmark envelope.
 */

export const CONDITION_ORDER = Object.freeze(["A", "B", "C"]);

export const CONDITION_DEFINITIONS = Object.freeze({
  A: { id: "A", label: "WAM baseline", impeccable: false, uxEvidenceEnforcement: false },
  B: { id: "B", label: "WAM + Impeccable", impeccable: true, uxEvidenceEnforcement: false },
  C: { id: "C", label: "WAM + Impeccable + UX outcome evidence", impeccable: true, uxEvidenceEnforcement: true },
});

export const BASELINE_CONDITION = "A";

/** Variables that MUST be identical across all conditions of a run. */
export const CONTROLLED_FACTORS = Object.freeze({
  model: "benchmark-fixture-model",
  specVersion: "frontend-ux-task-spec@1",
  tools: Object.freeze(["editor", "test-runner", "a11y-linter", "viewport-runner"]),
  constraints: Object.freeze(["offline", "no-network", "single-repo-snapshot"]),
});

/**
 * Deterministic JSON serialization (recursively sorted keys) used for
 * fingerprints and deviation detection.
 */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/** FNV-1a fingerprint of a value's stable serialization. */
export function fingerprint(value) {
  const s = typeof value === "string" ? value : stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, "0")}`;
}

/** Fingerprint of a case's immutable initial repo snapshot. */
export function initialStateFingerprint(caseEntry) {
  return fingerprint({
    snapshotId: caseEntry.baselineRepo.snapshotId,
    commit: caseEntry.baselineRepo.commit,
  });
}

/** Build the full context handed to the agent for one (case, condition). */
export function buildConditionContext(caseEntry, conditionId, controlled = CONTROLLED_FACTORS) {
  const def = CONDITION_DEFINITIONS[conditionId];
  if (!def) throw new Error(`unknown condition: ${conditionId}`);
  if (!caseEntry || !caseEntry.baselineRepo) throw new Error("caseEntry.baselineRepo is required");
  return {
    conditionId,
    label: def.label,
    features: { impeccable: def.impeccable, uxEvidenceEnforcement: def.uxEvidenceEnforcement },
    repoSnapshot: caseEntry.baselineRepo.snapshotId,
    repoCommit: caseEntry.baselineRepo.commit,
    model: controlled.model,
    specVersion: controlled.specVersion,
    tools: [...controlled.tools],
    constraints: [...controlled.constraints],
  };
}

/** Strip condition-specific fields, leaving only the controlled variables. */
export function controlledSignature(context) {
  const { conditionId, label, features, ...rest } = context;
  return rest;
}

/**
 * Compare the controlled variables across condition contexts for one case.
 * @returns {object[]} deviations (empty when the controlled variables match).
 */
export function detectDeviations(contexts) {
  const signatures = contexts.map((c) => ({
    conditionId: c.conditionId,
    signature: stableStringify(controlledSignature(c)),
  }));
  const unique = new Set(signatures.map((s) => s.signature));
  if (unique.size <= 1) return [];
  return [
    {
      field: "controlled-variables",
      detail: "controlled variables differ across conditions",
      byCondition: Object.fromEntries(signatures.map((s) => [s.conditionId, s.signature])),
    },
  ];
}
