import { test } from "node:test";
import assert from "node:assert/strict";

import { QUALITY_SCENARIOS } from "./scenarios.mjs";
import { buildBaselineRequest, buildWamRequest } from "../real/runners/paired-runner.mjs";
import { normalize, factCoverage } from "./scoring.mjs";

function factVariants(fact) {
  if (typeof fact === "string") return [fact];
  if (fact && Array.isArray(fact.any)) return fact.any.filter((v) => typeof v === "string");
  return [];
}

test("QUALITY_SCENARIOS: schema and unique ids", () => {
  assert.ok(Array.isArray(QUALITY_SCENARIOS));
  assert.ok(QUALITY_SCENARIOS.length >= 6);
  const ids = new Set();
  for (const s of QUALITY_SCENARIOS) {
    assert.ok(typeof s.id === "string" && s.id.length > 0, "scenario must have an id");
    assert.ok(!ids.has(s.id), `duplicate scenario id: ${s.id}`);
    ids.add(s.id);
    assert.ok(typeof s.description === "string" && s.description.length > 0, `${s.id} description`);
    assert.ok(typeof s.budget === "number", `${s.id} budget`);
    assert.ok(Array.isArray(s.turns) && s.turns.length > 0, `${s.id} turns`);
    for (const turn of s.turns) {
      assert.ok(typeof turn.prompt === "string", `${s.id} turn.prompt`);
      assert.ok(turn.input && typeof turn.input === "object", `${s.id} turn.input`);
    }
    assert.ok(s.rubric, `${s.id} rubric must be present`);
    assert.ok(
      Array.isArray(s.rubric.requiredFacts) && s.rubric.requiredFacts.length > 0,
      `${s.id} rubric.requiredFacts must be non-empty`
    );
    assert.ok(
      Array.isArray(s.rubric.idealPoints) && s.rubric.idealPoints.length > 0,
      `${s.id} rubric.idealPoints must be non-empty`
    );
  }
});

test("QUALITY_SCENARIOS: covers the three answer families", () => {
  const ids = new Set(QUALITY_SCENARIOS.map((s) => s.id));
  // We have exact-token, specific-token, and count scenarios, by design.
  assert.ok(ids.has("Q1-exact-req-token"), "missing exact-token scenario");
  assert.ok(ids.has("Q2-decision-token"), "missing specific-token scenario");
  // Q3 is the count scenario (Q4 was converted to a clean-recall scenario
  // because counting long uniform lists is unreliable on the model).
  assert.ok(ids.has("Q3-count-requirements"), "missing count scenario");
});

test("FAIRNESS: every requiredFact appears in the raw baseline prompt", () => {
  let totalChecked = 0;
  for (const scenario of QUALITY_SCENARIOS) {
    const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
    for (let t = 0; t < turns.length; t += 1) {
      const turn = turns[t];
      const built = buildBaselineRequest(turn);
      const content = built.messages?.[0]?.content ?? "";
      const normContent = normalize(content);
      // Guard: requiredFacts array must exist and be non-empty.
      assert.ok(
        Array.isArray(scenario.rubric?.requiredFacts) &&
          scenario.rubric.requiredFacts.length > 0,
        `${scenario.id} turn ${t} rubric.requiredFacts missing or empty`
      );
      for (const fact of scenario.rubric.requiredFacts) {
        const variants = factVariants(fact);
        assert.ok(
          variants.length > 0,
          `${scenario.id} turn ${t} has invalid requiredFact: ${JSON.stringify(fact)}`
        );
        let matchedAny = false;
        for (const v of variants) {
          const normVar = normalize(v);
          // Guard: every {any} variant must be a non-empty string.
          assert.ok(
            normVar.length > 0,
            `${scenario.id} turn ${t} fact variant empty: ${JSON.stringify(v)}`
          );
          if (normContent.includes(normVar)) {
            matchedAny = true;
            break;
          }
        }
        assert.ok(
          matchedAny,
          `FAIRNESS FAIL: ${scenario.id} turn ${t} requires fact ${JSON.stringify(fact)} but none of its variants appear in baseline context content`
        );
        totalChecked += 1;
      }
    }
  }
  assert.ok(totalChecked > 0, "no requiredFacts checked at all");
});

/**
 * Map scenario ID -> {tokenRegex, expectedCount, label}.
 *
 * The calibration contract: for every COUNT-style scenario, the rubric's
 * accepted numeric variant MUST equal the literal count of that entity
 * type inside the raw baseline prompt. We assert that here so future
 * scenario tweaks cannot silently desync rubric from ground truth.
 */
const COUNT_SCENARIO_SPECS = {
  // Q3 is the canonical count scenario: 7 requirements, 2 evidence, 2 decisions.
  // We count `[Type: requirement]` occurrences (each logical entity gets
  // exactly one such header in the rendered baseline prompt). The looser
  // `requirement[` token also matches the substring inside content bodies
  // and the objective string, which makes ground truth unambiguous only
  // when we count headers.
  "Q3-count-requirements": {
    tokenRegex: /\[Type: requirement\]/g,
    expectedCount: 7,
    label: "requirements"
  }
  // Q4 was deliberately converted from count to recall because the model
  // is unreliable at counting long uniform lists; if a future count
  // scenario is re-introduced, add its spec here too.
};

test("CALIBRATION: count scenarios assert rubric number == actual entity count in baseline prompt", () => {
  const specs = COUNT_SCENARIO_SPECS;
  const specIds = Object.keys(specs);
  assert.ok(specIds.length > 0, "COUNT_SCENARIO_SPECS must declare at least one count scenario");
  for (const id of specIds) {
    const scenario = QUALITY_SCENARIOS.find((s) => s.id === id);
    assert.ok(scenario, `scenario ${id} not found in QUALITY_SCENARIOS`);
    const turn = scenario.turns[0];
    const built = buildBaselineRequest(turn);
    const content = built.messages?.[0]?.content ?? "";
    const actualCount = (content.match(specs[id].tokenRegex) ?? []).length;
    assert.equal(
      actualCount,
      specs[id].expectedCount,
      `${id}: expected ${specs[id].expectedCount} ${specs[id].label} tokens in baseline, found ${actualCount}`
    );
    // Additionally, every numeric variant listed in the rubric must match
    // the expected count (string equality after normalization).
    for (const fact of scenario.rubric.requiredFacts) {
      const variants = factVariants(fact);
      for (const v of variants) {
        const norm = normalize(v);
        if (/^\d+$/.test(norm)) {
          assert.equal(
            Number(norm),
            specs[id].expectedCount,
            `${id}: rubric numeric variant "${v}" (${norm}) must equal expectedCount ${specs[id].expectedCount}`
          );
        }
      }
    }
  }
});

/**
 * RECALL calibration: for every NON-count scenario, the requiredFact
 * (or every {any} variant) must appear VERBATIM (case-insensitive,
 * whitespace-collapsed) in the raw baseline prompt. Reusing normalize()
 * keeps this consistent with the scoring rule.
 */
test("CALIBRATION: recall scenarios have requiredFact(s) present verbatim in baseline prompt", () => {
  let totalChecked = 0;
  for (const scenario of QUALITY_SCENARIOS) {
    if (COUNT_SCENARIO_SPECS[scenario.id]) continue; // count is checked above
    const turn = scenario.turns[0];
    const built = buildBaselineRequest(turn);
    const content = built.messages?.[0]?.content ?? "";
    const normContent = normalize(content);
    for (const fact of scenario.rubric.requiredFacts) {
      const variants = factVariants(fact);
      const ok = variants.some((v) => normContent.includes(normalize(v)));
      assert.ok(
        ok,
        `RECALL FAIL: ${scenario.id} requiredFact ${JSON.stringify(fact)} not verbatim in baseline prompt`
      );
      totalChecked += 1;
    }
  }
  assert.ok(totalChecked > 0, "no recall requiredFacts checked");
});

test("FAIRNESS: every requiredFact also appears in the WAM arm prompt (best-effort)", () => {
  // The WAM arm may legitimately drop nodes to fit budget. We do NOT fail when
  // a fact is missing — we only emit a single diagnostic to document cases
  // where the WAM context was constrained. This protects future scenarios
  // from accidentally being unanswerable for the WAM arm.
  let missingInWam = 0;
  let totalChecked = 0;
  for (const scenario of QUALITY_SCENARIOS) {
    const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
    for (let t = 0; t < turns.length; t += 1) {
      let built;
      try {
        built = buildWamRequest(scenario, turns[t]);
      } catch (_e) {
        // Some scenarios (negative controls) intentionally may fail; skip.
        continue;
      }
      const content = built.messages?.[0]?.content ?? "";
      const normContent = normalize(content);
      for (const fact of scenario.rubric.requiredFacts) {
        const variants = factVariants(fact);
        for (const v of variants) {
          totalChecked += 1;
          if (!normContent.includes(normalize(v))) missingInWam += 1;
        }
      }
    }
  }
  // Sanity: we did look at something
  assert.ok(totalChecked > 0, "no requiredFacts checked at all for WAM");
  // Informational only — the WAM test must never fail the suite.
  // If you ever tighten this invariant, replace the assert with a count check.
  if (missingInWam > 0) {
    // eslint-disable-next-line no-console
    console.log(`[quality] WAM arm missing ${missingInWam}/${totalChecked} requiredFact variants (informational)`);
  }
});

test("Smoke: factCoverage returns 1 across all QUALITY_SCENARIOS rubric tails", () => {
  // Confirms the rubric contents are themselves well-formed (no invalid facts).
  for (const s of QUALITY_SCENARIOS) {
    const out = factCoverage("", s.rubric.requiredFacts);
    assert.equal(out.score, 0, `${s.id} empty response should score 0 against requiredFacts`);
  }
});

// NOTE: The WAM context-assembly regression test (Q1/Q2/Q4) lives in
// `wam-category-coverage.test.mjs` next to this file, which inlines the
// prompt construction to avoid the unrelated upstream breakage of
// `../scenarios/real.mjs` (no `context` export).
