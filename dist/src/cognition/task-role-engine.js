/**
 * Task Role Engine — task-conditioned role replacement.
 *
 * Given an inferred directive (task-inference-engine.buildTaskInferenceDirective)
 * or its raw inputs (objective + requirements + prompt), produce a deterministic
 * role selection so the injected context uses the right voice/persona for the
 * task at hand.
 *
 * Design rules (mirror task-inference-engine.js):
 *  - Pure functions, no I/O. Deterministic for a given input.
 *  - Role taxonomy is a closed enum. Adding a role requires updating the enum
 *    AND adding a selection rule with verifiable evidence (file:line, regex,
 *    or explicit override). No "string fallback" that silently picks anything.
 *  - `selectRole` returns { role, confidence, evidence }. Callers decide
 *    thresholds — the engine never silently downgrades.
 *  - `buildRoleDirective` is the context-assembly hook. It returns `{ lines, role }`
 *    in the same shape as `buildTaskInferenceDirective` so callers can concat.
 *  - Idempotent: running `selectRole` twice on the same input yields the same
 *    output (no Date.now / Math.random).
 */

/**
 * Closed role taxonomy. Each role is a *voice* (presentation contract), not
 * a permission scope. Permissions are still controlled by the policy layer.
 */
export const ROLE = Object.freeze({
  IMPLEMENTER: "implementer",
  VERIFIER: "verifier",
  REVIEWER: "reviewer",
  OPERATOR: "operator",
  DOC_WRITER: "doc-writer",
  PLANNER: "planner",
});

/**
 * Role → markdown header for the directive. Kept here so the engine owns
 * its own rendering (no leakage into message-handler).
 */
const ROLE_HEADER = Object.freeze({
  [ROLE.IMPLEMENTER]: "Implementer Mode",
  [ROLE.VERIFIER]: "Verifier Mode",
  [ROLE.REVIEWER]: "Reviewer Mode",
  [ROLE.OPERATOR]: "Operator Mode",
  [ROLE.DOC_WRITER]: "Doc-Writer Mode",
  [ROLE.PLANNER]: "Planner Mode",
});

/**
 * Signal detectors. Each detector returns a tagged match (signal + matched
 * text). Deterministic regex, no global state.
 */
const SIGNAL_RULES = [
  // ─── Tier 1: requirement-shaped signals (scope=requirement) ───────────────
  {
    id: "verify-suffix",
    scope: "requirement",
    role: ROLE.VERIFIER,
    matches: (req) => /-verify\b|verify\b/i.test(req.id || "") || req.requiresVerification === true,
    weight: 0.9,
  },
  {
    id: "review-suffix",
    scope: "requirement",
    role: ROLE.REVIEWER,
    matches: (req) => /-review\b|review\b|data-review\b/i.test(req.id || ""),
    weight: 0.85,
  },
  {
    id: "rollback-suffix",
    scope: "requirement",
    role: ROLE.OPERATOR,
    matches: (req) => /-rollback\b|rollback\b|deploy\b/i.test(req.id || ""),
    weight: 0.8,
  },
  {
    id: "monitor-suffix",
    scope: "requirement",
    role: ROLE.OPERATOR,
    matches: (req) => /-monitor\b|monitor\b|isService\b|service\b/i.test(req.id || "") ||
      req.isService === true ||
      /service|servicio|endpoint|api|health|monitoring/i.test(req.description || ""),
    weight: 0.75,
  },
  {
    id: "docs-suffix",
    scope: "requirement",
    role: ROLE.DOC_WRITER,
    matches: (req) => /-docs\b|\bdocs?\b|documentation\b/i.test(req.id || "") ||
      req.public === true,
    weight: 0.7,
  },

  // ─── Tier 2: free-text prompt signals (scope=prompt) ───────────────────────
  {
    id: "prompt-implement",
    scope: "prompt",
    role: ROLE.IMPLEMENTER,
    matches: (_req, ctx) => /\b(implement|build|add|create|develop|refactor|fix)\b/i.test(ctx.objective || ""),
    weight: 0.55,
  },
  {
    id: "prompt-verify",
    scope: "prompt",
    role: ROLE.VERIFIER,
    matches: (_req, ctx) => /\b(verify|check|test|validate|prove)\b/i.test(ctx.objective || ""),
    weight: 0.5,
  },
  {
    id: "prompt-review",
    scope: "prompt",
    role: ROLE.REVIEWER,
    matches: (_req, ctx) => /\b(review|inspect|audit|examine)\b/i.test(ctx.objective || ""),
    weight: 0.5,
  },
  {
    id: "prompt-operate",
    scope: "prompt",
    role: ROLE.OPERATOR,
    matches: (_req, ctx) => /\b(deploy|rollback|restart|scale|operate|servicio|service)\b/i.test(ctx.objective || ""),
    weight: 0.5,
  },
  {
    id: "prompt-document",
    scope: "prompt",
    role: ROLE.DOC_WRITER,
    matches: (_req, ctx) => /\b(document|docs|write-up|readme|changelog)\b/i.test(ctx.objective || ""),
    weight: 0.5,
  },
  {
    id: "prompt-plan",
    scope: "prompt",
    role: ROLE.PLANNER,
    matches: (_req, ctx) => /\b(plan|design|architect|outline|break[- ]down)\b/i.test(ctx.objective || "") &&
      !/\b(implement|build|add|create)\b/i.test(ctx.objective || ""),
    weight: 0.45,
  },
];

/**
 * Aggregate scores per role across all signals.
 * @param {{ objective?: string, requirements?: Array<object> }} input
 * @returns {Array<{role:string, score:number, hits:Array<{signalId:string, weight:number, evidence:string}>}>}
 */
export function scoreRoles({ objective = "", requirements = [] } = {}) {
  const ctx = { objective: String(objective || "") };
  const tally = new Map();
  for (const role of Object.values(ROLE)) {
    tally.set(role, { role, score: 0, hits: [] });
  }

  // Tier 1: per-requirement suffix-shaped signals. Each rule fires at most
  // once per (role, signalId) regardless of how many requirements match —
  // this prevents repetition from drowning out higher-quality signals.
  for (const req of requirements || []) {
    for (const rule of SIGNAL_RULES) {
      if (rule.scope !== "requirement") continue;
      let matched = false;
      try {
        matched = rule.matches(req, ctx) === true;
      } catch {
        matched = false;
      }
      if (!matched) continue;
      const evidence = (req.id || req.title || "").toString() ||
        (req.description || "").toString().slice(0, 60);
      const bucket = tally.get(rule.role);
      const alreadyHas = bucket.hits.some((h) => h.signalId === rule.id);
      if (alreadyHas) continue;
      bucket.score += rule.weight;
      bucket.hits.push({
        signalId: rule.id,
        weight: rule.weight,
        evidence: String(evidence).slice(0, 80),
      });
    }
  }

  // Tier 2: free-text prompt signals. These run ONLY against the objective
  // (no per-req loop) and never against synthetic descriptions — words like
  // "endpoint" appearing in a sentence do NOT make the task a monitoring one.
  const synthetic = { id: "__prompt__", description: ctx.objective };
  for (const rule of SIGNAL_RULES) {
    if (rule.scope !== "prompt") continue;
    let matched = false;
    try {
      matched = rule.matches(synthetic, ctx) === true;
    } catch {
      matched = false;
    }
    if (!matched) continue;
    const bucket = tally.get(rule.role);
    const alreadyHas = bucket.hits.some((h) => h.signalId === rule.id);
    if (alreadyHas) continue;
    bucket.score += rule.weight;
    bucket.hits.push({
      signalId: rule.id,
      weight: rule.weight,
      evidence: ctx.objective.slice(0, 80),
    });
  }

  return [...tally.values()].sort((a, b) => b.score - a.score);
}

/**
 * Pick the highest-scoring role. Returns a stable object even when nothing
 * matches (default = IMPLEMENTER with confidence 0 + reasoning field).
 *
 * @param {{ objective?: string, requirements?: Array<object> }} input
 * @returns {{ role: string, confidence: number, evidence: Array<object>, scores: Array<{role:string, score:number}> }}
 */
export function selectRole({ objective = "", requirements = [] } = {}) {
  if (typeof objective !== "string" && objective !== undefined && objective !== null) {
    throw new TypeError("selectRole: objective must be a string");
  }
  if (!Array.isArray(requirements)) {
    throw new TypeError("selectRole: requirements must be an array");
  }

  const ranked = scoreRoles({ objective, requirements });
  const top = ranked[0];
  const total = ranked.reduce((s, r) => s + r.score, 0) || 1;
  const confidence = Math.min(1, Math.round((top.score / total) * 1000) / 1000);

  return {
    role: top.role,
    confidence,
    evidence: top.hits,
    scores: ranked.map((r) => ({ role: r.role, score: r.score })),
  };
}

/**
 * Context-assembly hook. Same return shape as buildTaskInferenceDirective
 * so callers can concatenate lines and reason about idempotence.
 *
 * @param {{ objective?: string, requirements?: Array<object> }} input
 * @returns {{ lines: string[], role: string, confidence: number }}
 */
export function buildRoleDirective({ objective = "", requirements = [] } = {}) {
  const { role, confidence, evidence } = selectRole({ objective, requirements });
  const header = ROLE_HEADER[role] || role;
  const evidenceLines = evidence.length
    ? evidence
        .slice(0, 5)
        .map((e) => `  - ${e.signalId} (w=${e.weight}) on "${e.evidence}"`)
        .join("\n")
    : "  - (no explicit signals — default fallback)";

  const lines = [
    `\n[wam role] ${header}`,
    `Confidence: ${(confidence * 100).toFixed(1)}%`,
    `Why this role:\n${evidenceLines}`,
    `Stay in this voice until the user changes task shape.`,
  ];
  return { lines, role, confidence };
}
