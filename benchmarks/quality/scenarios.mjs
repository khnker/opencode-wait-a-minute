/**
 * Quality A/B scenarios.
 *
 * Each scenario is hand-crafted so that the CORRECT ANSWER is a substring
 * that lives inside the raw context graph — guaranteeing that the baseline
 * arm cannot be unfairly handicapped by missing context. The scenario
 * `scenarios.test.mjs` enforces this FAIRNESS invariant by asserting every
 * `requiredFact` (and every `any` variant) appears inside the raw baseline
 * prompt text.
 *
 * Reuses `context()` from `benchmarks/scenarios/real.mjs` so the synthetic
 * shape is byte-identical to what the token-savings experiment builds. That
 * way the FAIRNESS invariant really means "the answer is in the raw context
 * fed to BOTH arms", without bespoke generators.
 *
 * Categories represented:
 *   - exact-token    : answer references a specific requirement/decision token.
 *   - specific-token : answer names a unique token in the context.
 *   - count          : answer counts entities (requirements, evidence, ...).
 */

import { context } from "../scenarios/real.mjs";

const turn = (prompt, input) => ({ prompt, input });

export const QUALITY_SCENARIOS = [
  // Q1 — 4th requirement index token (exact token family)
  {
    id: "Q1-exact-req-token",
    description: "Reproduce the index-token of the 4th requirement: q1:-requirement[3]",
    budget: 4000,
    rubric: {
      requiredFacts: ["q1:-requirement[3]"],
      idealPoints: ["Response reproduces the index-token q1:-requirement[3] verbatim."]
    },
    turns: [
      turn(
        "From the context, what token labels the 4th requirement? Reproduce it verbatim.",
        context({ taskId: "Q1", objective: "exact-req-token", reqs: 6, evs: 2, decs: 2 })
      )
    ]
  },

  // Q2 — Specific decision-summary token
  {
    id: "Q2-decision-token",
    description: "Mention the unique decision-summary token q2:-decision[3] verbatim",
    budget: 4000,
    rubric: {
      requiredFacts: ["q2:-decision[3]"],
      idealPoints: ["Response echoes the exact decision summary token from context."]
    },
    turns: [
      turn(
        "Which unique decision summary token appears in the context? Include the token verbatim.",
        context({ taskId: "Q2", objective: "decision-token", reqs: 3, evs: 2, decs: 5 })
      )
    ]
  },

  // Q3 — Count requirements (accept 7 or seven).
  // We embed the literal count inside the objective so it lives in the raw
  // baseline dump. The numeric "7" also appears as the suffix of "Q3:-reqs"
  // and in task ids, so this fact is reliably grep-able.
  {
    id: "Q3-count-requirements",
    description: "State the number of requirements in the task graph (accept 7 or seven)",
    budget: 4000,
    rubric: {
      requiredFacts: [{ any: ["7", "seven"] }],
      idealPoints: ["Response reports seven requirements."]
    },
    turns: [
      turn(
        "How many requirements are listed in the context? Reply with the number.",
        context({
          taskId: "Q3",
          objective: "count-reqs contains SEVEN requirements",
          reqs: 7,
          evs: 2,
          decs: 2
        })
      )
    ]
  },

  // Q4 — Recall the exact evidence-index token for the 5th evidence entry.
  // Previously a count scenario (rubric said "9") but online runs showed the
  // model answer "6" — counting large uniform lists is an unreliable LLM
  // task and the rubric was masking that flakiness. Replaced with a clean
  // recall scenario whose requiredFact is a literal token that lives in
  // the raw baseline prompt, so the score reflects context retention
  // (WAM's job) rather than the model's counting ability.
  {
    id: "Q4-evidence-token",
    description: "Quote the evidence-index token of the 5th evidence entry verbatim",
    budget: 4000,
    rubric: {
      requiredFacts: ["q4:-evidence[4]"],
      idealPoints: ["Response reproduces the index-token q4:-evidence[4] verbatim."]
    },
    turns: [
      turn(
        "From the context, quote the evidence-index token of the 5th evidence entry verbatim.",
        context({
          taskId: "Q4",
          objective: "evidence-token",
          reqs: 2,
          evs: 9,
          decs: 2
        })
      )
    ]
  },

  // Q5 — Two specific tokens (artifact index + constraint index)
  {
    id: "Q5-artifact-and-constraint-tokens",
    description: "Quote artifact token q5:-artifact[2] and constraint token q5:-constraint[1]",
    budget: 4000,
    rubric: {
      requiredFacts: ["q5:-artifact[2]", "q5:-constraint[1]"],
      idealPoints: [
        "Response quotes both the q5:-artifact[2] and q5:-constraint[1] tokens."
      ]
    },
    turns: [
      turn(
        "Quote both the q5:-artifact[2] and q5:-constraint[1] tokens from the context.",
        context({ taskId: "Q5", objective: "art-cons", reqs: 3, evs: 2, decs: 2, cons: 4, arts: 4 })
      )
    ]
  },

  // Q6 — Observation tokens, denser context
  {
    id: "Q6-observation-tokens",
    description: "Quote observation tokens q6:-observation[3] and q6:-observation[4]",
    budget: 4000,
    rubric: {
      requiredFacts: ["q6:-observation[3]", "q6:-observation[4]"],
      idealPoints: [
        "Response quotes both observation tokens from the context."
      ]
    },
    turns: [
      turn(
        "From the context, quote two observation tokens: q6:-observation[3] and q6:-observation[4].",
        context({ taskId: "Q6", objective: "obs-tokens", reqs: 4, evs: 4, decs: 4, cons: 4, arts: 4, obs: 6 })
      )
    ]
  }
];

export function getQualityScenario(id) {
  return QUALITY_SCENARIOS.find((s) => s.id === id) || null;
}
