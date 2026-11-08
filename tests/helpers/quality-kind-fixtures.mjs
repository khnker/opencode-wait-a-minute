import { TASK_EVIDENCE_TYPES, TASK_EVIDENCE_STRENGTH } from "../../src/verification/outcome-evaluator.js";

const evidence = (type, strength) => ({
  type,
  strength,
  status: "pass",
  sourceRef: "fixture",
});

export const QUALITY_KIND_FIXTURES = [
  {
    kind: "research",
    task: {
      id: "quality-fixture-research",
      kind: "research",
      objective: "Investigate the options",
      requirements: [{ id: "r1", evidence: [evidence(TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_STRENGTH.L3_DIRECT)] }],
    },
  },
  {
    kind: "implementation",
    task: {
      id: "quality-fixture-implementation",
      kind: "implementation",
      objective: "Implement the feature",
      requirements: [{
        id: "r1",
        evidence: [
          evidence(TASK_EVIDENCE_TYPES.TEST_RESULT, TASK_EVIDENCE_STRENGTH.L4_VERIFICATION),
          evidence(TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_STRENGTH.L3_DIRECT),
        ],
      }],
    },
  },
  {
    kind: "debugging",
    task: {
      id: "quality-fixture-debugging",
      kind: "debugging",
      objective: "Fix the regression",
      requirements: [{
        id: "r1",
        evidence: [
          evidence(TASK_EVIDENCE_TYPES.TOOL_OUTPUT, TASK_EVIDENCE_STRENGTH.L3_DIRECT),
          evidence(TASK_EVIDENCE_TYPES.TEST_RESULT, TASK_EVIDENCE_STRENGTH.L4_VERIFICATION),
        ],
      }],
    },
  },
  {
    kind: "refactoring",
    task: {
      id: "quality-fixture-refactoring",
      kind: "refactoring",
      objective: "Refactor the module",
      requirements: [{
        id: "r1",
        evidence: [
          evidence(TASK_EVIDENCE_TYPES.TEST_RESULT, TASK_EVIDENCE_STRENGTH.L4_VERIFICATION),
          evidence(TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_STRENGTH.L3_DIRECT),
        ],
      }],
    },
  },
  {
    kind: "review",
    task: {
      id: "quality-fixture-review",
      kind: "review",
      objective: "Review the change",
      requirements: [{ id: "r1", evidence: [evidence(TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_STRENGTH.L3_DIRECT)] }],
    },
  },
  {
    kind: "documentation",
    task: {
      id: "quality-fixture-documentation",
      kind: "documentation",
      objective: "Document the behavior",
      requirements: [{ id: "r1", evidence: [evidence(TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_STRENGTH.L3_DIRECT)] }],
    },
  },
];
