import { describe, it } from "node:test";
import assert from "node:assert/strict";

import * as contractsModule from "../../src/agents/role-contracts.js";
import {
  AGENT_ROLES,
  AGENT_STATUSES,
  RoleContractError,
  assertAgentRequest,
  assertAgentResult,
  getRoleCapabilities,
  getRoleDefinition,
  builderRoleForLayer,
  isBuilderRole,
  validateAgentRequest,
  validateAgentResult,
} from "../../src/agents/role-contracts.js";

function baseRequest(role, overrides = {}) {
  return {
    taskId: "task-1",
    invocationId: "inv-1",
    role,
    objective: "Ship the change",
    acceptanceCriteria: [
      { id: "criterion-1", description: "Behaviour is correct", mandatory: true },
    ],
    input: {
      artifacts: [],
      evidence: [],
      constraints: [],
      priorFindings: [],
    },
    expectedOutput: ["findings", "evidence"],
    ...overrides,
  };
}

function baseResult(role, overrides = {}) {
  return {
    taskId: "task-1",
    invocationId: "inv-1",
    role,
    status: "COMPLETED",
    summary: "Work finished",
    findings: [],
    decisions: [],
    artifacts: [],
    evidence: [],
    openQuestions: [],
    recommendations: [],
    limitations: [],
    ...overrides,
  };
}

function acceptedReview(overrides = {}) {
  return {
    verdict: "ACCEPTED",
    findings: [],
    limitations: [],
    ...overrides,
  };
}

function reviewFinding(overrides = {}) {
  return {
    criterionId: "criterion-1",
    severity: "HIGH",
    description: "The retry branch is unreachable",
    evidence: ["ev-diff"],
    correctiveAction: "Move the retry guard before the early return",
    ...overrides,
  };
}

describe("role catalog", () => {
  it("defines the pipeline roles plus backend/frontend/UX specializations", () => {
    assert.deepEqual(Object.values(AGENT_ROLES).sort(), [
      "ANALYST",
      "ARCHITECT",
      "BACKEND_ENGINEER",
      "BUILDER",
      "FRONTEND_ENGINEER",
      "REVIEWER",
      "UX_DESIGNER",
    ]);
  });

  it("defines statuses without a DONE value", () => {
    assert.deepEqual([...AGENT_STATUSES], [
      "COMPLETED",
      "BLOCKED",
      "NEEDS_INPUT",
      "FAILED",
    ]);
    assert.equal(AGENT_STATUSES.includes("DONE"), false);
  });

  it("declares responsibilities and limits for every role", () => {
    for (const role of Object.values(AGENT_ROLES)) {
      const definition = getRoleDefinition(role);
      assert.ok(definition.responsibility.length > 0);
      assert.ok(definition.limits.length > 0);
    }
    assert.ok(
      getRoleDefinition(AGENT_ROLES.REVIEWER).limits.includes(
        "Does not execute tests in this iteration"
      )
    );
    assert.throws(() => getRoleDefinition("VERIFIER"), RoleContractError);
  });

  it("selects a layer-aware implementation role", () => {
    assert.equal(builderRoleForLayer("backend"), AGENT_ROLES.BACKEND_ENGINEER);
    assert.equal(builderRoleForLayer("frontend"), AGENT_ROLES.FRONTEND_ENGINEER);
    assert.equal(builderRoleForLayer("shared"), AGENT_ROLES.BUILDER);
    assert.equal(isBuilderRole(AGENT_ROLES.BACKEND_ENGINEER), true);
    assert.equal(isBuilderRole(AGENT_ROLES.UX_DESIGNER), false);
  });

  it("declares layer, focus and preferred skills for specialized roles", () => {
    assert.equal(getRoleDefinition(AGENT_ROLES.BACKEND_ENGINEER).layer, "backend");
    assert.equal(getRoleDefinition(AGENT_ROLES.FRONTEND_ENGINEER).layer, "frontend");
    assert.equal(getRoleDefinition(AGENT_ROLES.UX_DESIGNER).layer, "frontend");
    assert.ok(getRoleDefinition(AGENT_ROLES.UX_DESIGNER).focus.includes("accessibility"));
    assert.ok(getRoleDefinition(AGENT_ROLES.BACKEND_ENGINEER).skills.includes("backend-integrity"));
    assert.ok(getRoleDefinition(AGENT_ROLES.FRONTEND_ENGINEER).skills.includes("web-design"));
  });

  it("declares the capability matrix exactly", () => {
    const expected = {
      ANALYST: {
        readContext: true,
        investigate: true,
        proposeDecisions: true,
        modifyCode: false,
        modifyGlobalState: false,
        approveCompletion: false,
      },
      ARCHITECT: {
        readContext: true,
        investigate: true,
        proposeDecisions: true,
        modifyCode: false,
        modifyGlobalState: false,
        approveCompletion: false,
      },
      BUILDER: {
        readContext: true,
        investigate: true,
        proposeDecisions: false,
        modifyCode: true,
        modifyGlobalState: false,
        approveCompletion: false,
      },
      BACKEND_ENGINEER: {
        readContext: true,
        investigate: true,
        proposeDecisions: false,
        modifyCode: true,
        modifyGlobalState: false,
        approveCompletion: false,
      },
      FRONTEND_ENGINEER: {
        readContext: true,
        investigate: true,
        proposeDecisions: false,
        modifyCode: true,
        modifyGlobalState: false,
        approveCompletion: false,
      },
      UX_DESIGNER: {
        readContext: true,
        investigate: true,
        proposeDecisions: true,
        modifyCode: false,
        modifyGlobalState: false,
        approveCompletion: false,
      },
      REVIEWER: {
        readContext: true,
        investigate: true,
        proposeDecisions: true,
        modifyCode: false,
        modifyGlobalState: false,
        approveCompletion: false,
      },
    };
    for (const role of Object.values(AGENT_ROLES)) {
      assert.deepEqual(getRoleCapabilities(role), expected[role]);
    }
    assert.equal(Object.isFrozen(contractsModule.ROLE_CAPABILITIES), true);
  });

  it("does not expose permission enforcement", () => {
    assert.equal(contractsModule.assertRolePermission, undefined);
    assert.equal(contractsModule.canRole, undefined);
    assert.equal(contractsModule.assertRoleInput, undefined);
  });
});

describe("AgentRequest contract", () => {
  it("accepts a valid request for every role", () => {
    for (const role of Object.values(AGENT_ROLES)) {
      assert.equal(validateAgentRequest(baseRequest(role)).valid, true);
    }
  });

  it("rejects unknown roles", () => {
    const { valid, issues } = validateAgentRequest(baseRequest("VERIFIER"));
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("unknown role")));
  });

  it("requires invocation identity", () => {
    const request = baseRequest(AGENT_ROLES.ANALYST);
    delete request.invocationId;
    const { valid, issues } = validateAgentRequest(request);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("invocationId")));
  });

  it("rejects unknown top-level fields", () => {
    const request = baseRequest(AGENT_ROLES.ANALYST, {
      fullTaskState: {},
    });
    const { valid, issues } = validateAgentRequest(request);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("fullTaskState")));
  });

  it("rejects undeclared input fields", () => {
    const request = baseRequest(AGENT_ROLES.ANALYST);
    request.input.fullContext = {};
    const { valid, issues } = validateAgentRequest(request);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("input.fullContext")));
  });

  it("requires well-formed acceptance criteria", () => {
    const request = baseRequest(AGENT_ROLES.ANALYST, {
      acceptanceCriteria: [
        { id: "criterion-1", description: "", mandatory: "yes" },
      ],
    });
    const { valid, issues } = validateAgentRequest(request);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("description")));
    assert.ok(issues.some((issue) => issue.includes("mandatory")));
  });

  it("rejects duplicate acceptance criterion ids", () => {
    const request = baseRequest(AGENT_ROLES.ANALYST, {
      acceptanceCriteria: [
        { id: "criterion-1", description: "one", mandatory: true },
        { id: "criterion-1", description: "two", mandatory: true },
      ],
    });
    const { valid, issues } = validateAgentRequest(request);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("duplicates criterion-1")));
  });

  it("requires expected output", () => {
    const request = baseRequest(AGENT_ROLES.ANALYST, { expectedOutput: [] });
    const { valid, issues } = validateAgentRequest(request);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("expectedOutput")));
  });

  it("validates prior findings", () => {
    const request = baseRequest(AGENT_ROLES.ARCHITECT);
    request.input.priorFindings = [
      { id: "f1", description: "", severity: "INFO", evidence: "ev-1" },
    ];
    const { valid, issues } = validateAgentRequest(request);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("severity")));
    assert.ok(issues.some((issue) => issue.includes("evidence must be an array")));
  });

  it("throws with every issue through the assertion helper", () => {
    const request = baseRequest("VERIFIER");
    delete request.invocationId;
    assert.throws(
      () => assertAgentRequest(request),
      (error) => {
        assert.ok(error instanceof RoleContractError);
        assert.ok(error.issues.some((issue) => issue.includes("unknown role")));
        assert.ok(error.issues.some((issue) => issue.includes("invocationId")));
        return true;
      }
    );
  });
});

describe("AgentResult contract", () => {
  it("accepts a valid result for every role", () => {
    for (const role of Object.values(AGENT_ROLES)) {
      const result = baseResult(role);
      if (role === AGENT_ROLES.REVIEWER) result.review = acceptedReview();
      assert.equal(validateAgentResult(result).valid, true);
    }
  });

  it("rejects unknown roles and statuses", () => {
    const result = baseResult(AGENT_ROLES.ANALYST, {
      role: "VERIFIER",
      status: "IN_PROGRESS",
    });
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("unknown role")));
    assert.ok(issues.some((issue) => issue.includes("status must be one of")));
  });

  it("does not allow an agent to declare DONE", () => {
    const byStatus = baseResult(AGENT_ROLES.BUILDER, { status: "DONE" });
    assert.equal(validateAgentResult(byStatus).valid, false);

    const byField = baseResult(AGENT_ROLES.BUILDER, { done: true });
    const { valid, issues } = validateAgentResult(byField);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("done is not part of the contract")));
  });

  it("requires a summary and limitations", () => {
    const result = baseResult(AGENT_ROLES.BUILDER);
    delete result.summary;
    delete result.limitations;
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("summary")));
    assert.ok(issues.some((issue) => issue.includes("limitations")));
  });

  it("validates findings and decisions", () => {
    const result = baseResult(AGENT_ROLES.ANALYST, {
      findings: [
        { id: "f1", description: "", severity: "URGENT", evidence: "ev-1" },
      ],
      decisions: [{ id: "d1", description: "", rationale: "" }],
    });
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("severity")));
    assert.ok(issues.some((issue) => issue.includes("evidence must be an array")));
    assert.ok(issues.some((issue) => issue.includes("decisions[0].description")));
    assert.ok(issues.some((issue) => issue.includes("decisions[0].rationale")));
  });

  it("rejects duplicate finding ids", () => {
    const finding = {
      id: "f1",
      description: "first",
      severity: "LOW",
      evidence: [],
    };
    const result = baseResult(AGENT_ROLES.ANALYST, {
      findings: [finding, { ...finding, description: "second" }],
    });
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("duplicates f1")));
  });

  it("rejects review from non-Reviewer roles", () => {
    const result = baseResult(AGENT_ROLES.BUILDER, { review: acceptedReview() });
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("only allowed for the reviewer")));
  });

  it("requires review for the Reviewer unless the invocation failed", () => {
    const missing = baseResult(AGENT_ROLES.REVIEWER);
    const missingResult = validateAgentResult(missing);
    assert.equal(missingResult.valid, false);
    assert.ok(
      missingResult.issues.some((issue) => issue.includes("review is required"))
    );

    const failed = baseResult(AGENT_ROLES.REVIEWER, { status: "FAILED" });
    assert.equal(validateAgentResult(failed).valid, true);
  });
});

describe("ReviewResult contract", () => {
  it("accepts ACCEPTED without findings", () => {
    const result = baseResult(AGENT_ROLES.REVIEWER, {
      review: acceptedReview(),
    });
    assert.equal(validateAgentResult(result).valid, true);
  });

  it("requires findings for revision and replan verdicts", () => {
    for (const verdict of ["REVISION_REQUIRED", "REPLAN_REQUIRED"]) {
      const result = baseResult(AGENT_ROLES.REVIEWER, {
        review: acceptedReview({ verdict, findings: [] }),
      });
      const { valid, issues } = validateAgentResult(result);
      assert.equal(valid, false);
      assert.ok(issues.some((issue) => issue.includes(`must not be empty for ${verdict}`)));
    }
  });

  it("accepts a revision verdict with a fully specified finding", () => {
    const result = baseResult(AGENT_ROLES.REVIEWER, {
      review: {
        verdict: "REVISION_REQUIRED",
        findings: [reviewFinding()],
        limitations: ["Tests were not re-executed"],
      },
    });
    assert.equal(validateAgentResult(result).valid, true);
  });

  it("requires evidence for review findings", () => {
    const result = baseResult(AGENT_ROLES.REVIEWER, {
      review: {
        verdict: "REVISION_REQUIRED",
        findings: [reviewFinding({ evidence: [] })],
        limitations: [],
      },
    });
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("must not be empty")));
  });

  it("validates review finding fields and verdict", () => {
    const result = baseResult(AGENT_ROLES.REVIEWER, {
      review: {
        verdict: "APPROVED",
        findings: [
          reviewFinding({ severity: "URGENT", description: "", correctiveAction: "" }),
        ],
        limitations: [],
      },
    });
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("review.verdict")));
    assert.ok(issues.some((issue) => issue.includes("severity")));
    assert.ok(issues.some((issue) => issue.includes("description")));
    assert.ok(issues.some((issue) => issue.includes("correctiveAction")));
  });

  it("keeps review verdict and agent status consistent", () => {
    const completedButBlocked = baseResult(AGENT_ROLES.REVIEWER, {
      review: acceptedReview({ verdict: "BLOCKED" }),
    });
    const first = validateAgentResult(completedButBlocked);
    assert.equal(first.valid, false);
    assert.ok(
      first.issues.some((issue) => issue.includes("BLOCKED requires status BLOCKED"))
    );

    const blockedButAccepted = baseResult(AGENT_ROLES.REVIEWER, {
      status: "BLOCKED",
      review: acceptedReview(),
    });
    const second = validateAgentResult(blockedButAccepted);
    assert.equal(second.valid, false);
    assert.ok(
      second.issues.some((issue) => issue.includes("status BLOCKED requires"))
    );

    const blocked = baseResult(AGENT_ROLES.REVIEWER, {
      status: "BLOCKED",
      review: acceptedReview({ verdict: "BLOCKED" }),
    });
    assert.equal(validateAgentResult(blocked).valid, true);
  });

  it("rejects unknown review fields", () => {
    const result = baseResult(AGENT_ROLES.REVIEWER, {
      review: acceptedReview({ acceptedBy: "builder" }),
    });
    const { valid, issues } = validateAgentResult(result);
    assert.equal(valid, false);
    assert.ok(issues.some((issue) => issue.includes("review.acceptedBy")));
  });
});
