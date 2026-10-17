export const SCENARIO_STATES = ["UNVERIFIED", "VERIFIED", "REGRESSION"];

export function createScenario({ name, input, expected_behavior }) {
  if (!name || !input || !expected_behavior) {
    throw new Error("scenario requires name, input, expected_behavior");
  }
  return { name, input, expected_behavior, status: "UNVERIFIED" };
}

export async function runPressureScenario(scenario, agent) {
  if (typeof agent !== "function") throw new Error("agent must be a function");
  const behavior = await agent(scenario.input);
  return {
    scored: behavior === scenario.expected_behavior,
    behavior,
    evidence: { input: scenario.input, behavior },
  };
}

export function comparePressure(baseline, withSkill, scenario) {
  const demonstrated = withSkill.scored && !baseline.scored;
  return {
    status: demonstrated ? "VERIFIED" : "UNVERIFIED",
    demonstrated,
    baseline: baseline.behavior,
    withSkill: withSkill.behavior,
    expected: scenario.expected_behavior,
  };
}

export function detectRegression(previousStatus, current) {
  if (previousStatus === "VERIFIED" && !current.scored) return { regression: true, status: "REGRESSION" };
  return { regression: false, status: current.scored ? "VERIFIED" : "UNVERIFIED" };
}

export function registerScenario(scenario, benchmark = []) {
  return [...benchmark, scenario];
}
