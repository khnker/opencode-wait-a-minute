import test from "node:test";
import assert from "node:assert/strict";

import {
  APPROVED_STRATEGY_VERSION,
  assertApprovedStrategy,
  buildApprovedStrategy,
} from "../../src/agents/approved-strategy.js";
import { RoleContractError, assertAgentRequest } from "../../src/agents/role-contracts.js";

const DECISIONS = [
  {
    id: "D1",
    description: "Use an auth middleware",
    rationale: "centralized enforcement",
  },
  {
    id: "D2",
    description: "Persist sessions server side",
    rationale: "revocation support",
  },
];

function validStrategy(overrides = {}) {
  return {
    version: APPROVED_STRATEGY_VERSION,
    source: "ARCHITECT",
    approvedBy: "ORCHESTRATOR",
    decisions: DECISIONS,
    constraints: ["keep backward compatibility"],
    ...overrides,
  };
}

test("builds a frozen, deterministic approved strategy", () => {
  const first = buildApprovedStrategy({
    decisions: DECISIONS,
    constraints: ["keep backward compatibility"],
  });
  const second = buildApprovedStrategy({
    decisions: DECISIONS,
    constraints: ["keep backward compatibility"],
  });

  assert.deepEqual(first, {
    version: 1,
    source: "ARCHITECT",
    approvedBy: "ORCHESTRATOR",
    decisions: DECISIONS,
    constraints: ["keep backward compatibility"],
  });
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first), [
    "version",
    "source",
    "approvedBy",
    "decisions",
    "constraints",
  ]);
});

test("freezes the strategy, decisions and constraints", () => {
  const strategy = buildApprovedStrategy({
    decisions: DECISIONS,
    constraints: ["keep backward compatibility"],
  });

  assert.equal(Object.isFrozen(strategy), true);
  assert.equal(Object.isFrozen(strategy.decisions), true);
  assert.equal(Object.isFrozen(strategy.decisions[0]), true);
  assert.equal(Object.isFrozen(strategy.constraints), true);
  assert.throws(() => {
    strategy.decisions.push(DECISIONS[0]);
  }, TypeError);
  assert.throws(() => {
    strategy.constraints[0] = "mutated";
  }, TypeError);
});

test("defaults decisions and constraints to empty arrays", () => {
  assert.deepEqual(buildApprovedStrategy(), {
    version: 1,
    source: "ARCHITECT",
    approvedBy: "ORCHESTRATOR",
    decisions: [],
    constraints: [],
  });
});

test("accepts a valid strategy and returns it unchanged", () => {
  const strategy = validStrategy();
  assert.equal(assertApprovedStrategy(strategy), strategy);
});

test("rejects invalid strategy shapes with stable issues", () => {
  const cases = [
    [null, /must be an object/],
    [validStrategy({ version: 2 }), /version must be 1/],
    [validStrategy({ source: "BUILDER" }), /source must be "ARCHITECT"/],
    [validStrategy({ approvedBy: "REVIEWER" }), /approvedBy must be "ORCHESTRATOR"/],
    [validStrategy({ extra: true }), /extra is not part of the approved strategy contract/],
    [validStrategy({ decisions: "D1" }), /decisions must be an array/],
    [validStrategy({ constraints: "keep" }), /constraints must be an array/],
    [
      validStrategy({ decisions: [{ id: "D1", description: "", rationale: "x" }] }),
      /decisions\[0\]\.description must be a non-empty string/,
    ],
    [
      validStrategy({ constraints: [""] }),
      /constraints\[0\] must be a non-empty string/,
    ],
  ];

  for (const [strategy, pattern] of cases) {
    assert.throws(
      () => assertApprovedStrategy(strategy),
      (error) => error instanceof RoleContractError && pattern.test(error.message),
    );
  }
});

test("rejects duplicate decision ids and decision extras", () => {
  assert.throws(
    () =>
      assertApprovedStrategy(
        validStrategy({ decisions: [DECISIONS[0], { ...DECISIONS[0] }] }),
      ),
    (error) =>
      error instanceof RoleContractError &&
      /decisions\[1\]\.id duplicates D1/.test(error.message),
  );

  assert.throws(
    () =>
      assertApprovedStrategy(
        validStrategy({ decisions: [{ ...DECISIONS[0], extra: true }] }),
      ),
    (error) =>
      error instanceof RoleContractError &&
      /decisions\[0\]\.extra is not part of the contract/.test(error.message),
  );
});

test("build fails loud on malformed decisions", () => {
  assert.throws(
    () => buildApprovedStrategy({ decisions: [{ id: "D1" }] }),
    (error) => error instanceof RoleContractError,
  );
  assert.throws(
    () => buildApprovedStrategy({ decisions: "D1" }),
    (error) => error instanceof RoleContractError,
  );
  assert.throws(
    () => buildApprovedStrategy({ constraints: "keep" }),
    (error) => error instanceof RoleContractError,
  );
});

function builderRequest(approvedStrategy) {
  return {
    taskId: "task-1",
    invocationId: "task-1:BUILDER:1",
    role: "BUILDER",
    objective: "implement the approved strategy",
    acceptanceCriteria: [
      {
        id: "AC1",
        description: "Auth is enforced",
        mandatory: true,
        evidenceRequirements: { tests: ["unit"] },
      },
    ],
    input: {
      artifacts: [],
      evidence: [],
      constraints: [],
      priorFindings: [],
      approvedStrategy,
    },
    expectedOutput: ["artifacts"],
  };
}

test("request contract accepts a valid strategy", () => {
  const request = builderRequest(validStrategy());
  assert.equal(assertAgentRequest(request), request);
});

test("request contract rejects a malformed strategy", () => {
  assert.throws(
    () => assertAgentRequest(builderRequest(validStrategy({ version: 2 }))),
    (error) =>
      error instanceof RoleContractError &&
      /input\.approvedStrategy\.version must be 1/.test(error.message),
  );
  assert.throws(
    () =>
      assertAgentRequest(
        builderRequest(validStrategy({ decisions: "D1", constraints: [] })),
      ),
    (error) =>
      error instanceof RoleContractError &&
      /input\.approvedStrategy\.decisions must be an array/.test(error.message),
  );
});
