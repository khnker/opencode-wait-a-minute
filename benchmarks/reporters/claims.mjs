export const CLAIM_LEVELS = ["simulated", "estimated", "derived", "measured", "observed"];

const SOURCE_TO_CLAIM = {
  provider: "observed",
  trace: "measured",
  tokenizer: "measured",
  estimated: "estimated",
  simulation: "simulated",
  simulated: "simulated",
  deterministic_simulation: "simulated"
};

export function classify(measurement) {
  const source =
    typeof measurement === "string"
      ? measurement
      : measurement && measurement.tokenSource;
  return SOURCE_TO_CLAIM[source] || "estimated";
}

export const EVIDENCE_CATEGORIES = {
  execution: ["deterministic_simulation", "provider_execution"],
  tokens: ["simulated", "observed", "estimated", "measured"],
  correctness: ["fixture_defined", "verified"],
  mechanism: ["measured", "derived", "estimated"]
};

export function buildEvidence({ execution, tokens, correctness, mechanism }) {
  for (const [k, v] of Object.entries({ execution, tokens, correctness, mechanism })) {
    const allowed = EVIDENCE_CATEGORIES[k];
    if (!allowed || !allowed.includes(v)) {
      throw new Error(`buildEvidence: unknown ${k} value "${v}"`);
    }
  }
  return { execution, tokens, correctness, mechanism };
}

export const DETERMINISTIC_EVIDENCE = buildEvidence({
  execution: "deterministic_simulation",
  tokens: "simulated",
  correctness: "fixture_defined",
  mechanism: "measured"
});

export const EMPIRICAL_EVIDENCE = buildEvidence({
  execution: "provider_execution",
  tokens: "observed",
  correctness: "verified",
  mechanism: "measured"
});