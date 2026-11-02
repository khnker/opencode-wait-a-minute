# Tasks — Define Agent Role Contracts

## 1. Role taxonomy

- [x] 1.1 Define `AgentRole` as a closed enum with the four initial roles.
- [x] 1.2 Define responsibilities and limits for each role.
- [x] 1.3 Define the declarative capability matrix.
- [x] 1.4 Document deferred roles (Verifier, Integrator).

## 2. Agent contracts

- [x] 2.1 Define `AgentRequest`.
- [x] 2.2 Define `AgentResult`.
- [x] 2.3 Define artifact and evidence references.
- [x] 2.4 Define agent execution statuses without `DONE`.
- [x] 2.5 Implement request and result validators.

## 3. Reviewer contract

- [x] 3.1 Define `ReviewResult`.
- [x] 3.2 Define review verdicts and finding severities.
- [x] 3.3 Require evidence for every defect reported.
- [x] 3.4 Declare that the Reviewer does not execute tests.
- [x] 3.5 Declare that `ACCEPTED` does not authorize completion.

## 4. Tests

- [x] 4.1 Validate complete requests and results for every role.
- [x] 4.2 Reject unknown roles and invalid statuses.
- [x] 4.3 Validate references, required fields and duplicate ids.
- [x] 4.4 Verify that no contract allows declaring `DONE`.
- [x] 4.5 Verify that capabilities are data, not enforcement.

## 5. Validation

- [x] 5.1 Run `node --test --test-force-exit tests/unit/agent-role-contracts.test.mjs`.
- [x] 5.2 Run `openspec validate --changes --strict`.
- [x] 5.3 Verify compatibility with the existing task and evidence model.
