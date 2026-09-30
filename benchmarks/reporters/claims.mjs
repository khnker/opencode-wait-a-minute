export const CLAIM_LEVELS = ["observed", "measured", "derived", "estimated"];

const SOURCE_TO_CLAIM = {
  provider: "observed",
  trace: "measured",
  tokenizer: "measured",
  estimated: "estimated"
};

export function classify(measurement) {
  const source =
    typeof measurement === "string"
      ? measurement
      : measurement && measurement.tokenSource;
  return SOURCE_TO_CLAIM[source] || "estimated";
}
