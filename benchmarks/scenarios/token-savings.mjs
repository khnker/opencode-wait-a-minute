export const SCENARIO_DEFINITIONS = [
  {
    id: "S1",
    name: "Simple task",
    objective: "Complete a single-step task.",
    expectedWork: 1,
    verificationRequirements: 1
  },
  {
    id: "S2",
    name: "Multi-step implementation",
    objective: "Implement a multi-file change across several turns.",
    expectedWork: 1,
    verificationRequirements: 1
  },
  {
    id: "S3",
    name: "Failed implementation and retry",
    objective: "Recover from a failed attempt and complete the task.",
    expectedWork: 1,
    verificationRequirements: 1
  },
  {
    id: "S4",
    name: "Long-running continuation",
    objective: "Sustain a long-running task across many turns.",
    expectedWork: 1,
    verificationRequirements: 1
  },
  {
    id: "S5",
    name: "Multi-task/session switching",
    objective: "Switch between concurrent tasks without losing state.",
    expectedWork: 1,
    verificationRequirements: 1
  },
  {
    id: "S6",
    name: "Overhead regression (no clamping)",
    objective: "Model a legitimate case where WAM consumes more tokens.",
    expectedWork: 1,
    verificationRequirements: 1
  }
];

export function getScenario(id) {
  return SCENARIO_DEFINITIONS.find((s) => s.id === id) || null;
}
