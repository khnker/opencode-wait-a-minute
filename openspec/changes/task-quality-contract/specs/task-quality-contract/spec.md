# Task Quality Contract

## ADDED Requirements

### Requirement: Task Quality Contract Structure

The system SHALL support task quality contracts that declare, for a task, the objective, acceptance criteria with explicit evidence requirements, unresolved unknowns, and planning assumptions.

```javascript
{
  taskId: string,
  objective: string,
  acceptanceCriteria: [
    {
      id: string,
      description: string,
      mandatory: boolean,
      evidenceRequirements: {
        types: EvidenceType[],
        minStrength: EvidenceStrength,
        sourceConstraints?: string[]
      }
    }
  ],
  unknowns: Array<{
    id: string,
    question: string,
    status: "resolved" | "unresolved" | "blocking"
  }>,
  assumptions: Array<{
    id: string,
    statement: string,
    status: "resolved" | "unresolved",
    classification?: string
  }>
}
```

#### Scenario: Contract defines objective and acceptance criteria

- GIVEN a task requiring completion evidence
- WHEN a task quality contract is created
- THEN it includes `taskId`, `objective`, and `acceptanceCriteria`
- AND each criterion declares `mandatory` and its `evidenceRequirements`

#### Scenario: Contract records unknowns and assumptions

- GIVEN a task with open questions and planning assumptions
- WHEN the contract is created
- THEN it includes `unknowns` with resolution status
- AND `assumptions` with resolution status and optional classification

### Requirement: Evidence Requirements

The system SHALL express evidence requirements using the evidence types and strength levels defined in `src/evidence/evidence.js`, with optional source constraints.

#### Scenario: Evidence requirement declares types and minimum strength

- GIVEN a task quality contract criterion
- WHEN its `evidenceRequirements` are defined
- THEN `types` are drawn from the evidence types (DIRECT, DERIVED, INFERRED, NEGATIVE, ENVIRONMENT, TOOL_OUTPUT, TEST_RESULT, USER_CONFIRMATION)
- AND `minStrength` is drawn from the evidence strength levels (L0_CLAIM, L1_INFERENCE, L2_OBSERVATION, L3_DIRECT, L4_VERIFICATION)
- AND optional `sourceConstraints` limit which sources the evidence may come from

### Requirement: Task Profiling

The request classifier SHALL return a task profile including primary and secondary task types, a confidence score, justification, and a suggested evidence requirements profile.

#### Scenario: Classifier returns a task profile

- GIVEN an incoming request
- WHEN the request classifier processes it
- THEN it returns a primary task type (research, creation, modification, debugging, review)
- AND secondary task types when applicable
- AND a confidence score (0-100) with justification linking the classification to patterns or context
- AND a suggested evidence requirements profile based on task type

### Requirement: Evidence Gate Functionality

The completion gate SHALL evaluate all mandatory acceptance criteria for evidence sufficiency and block transition to DONE when any mandatory criterion lacks sufficient evidence.

#### Scenario: Mandatory criterion lacks sufficient evidence

- GIVEN a task with a mandatory acceptance criterion
- AND no supporting evidence meets the required strength
- WHEN the completion gate evaluates the task
- THEN transition to DONE is blocked
- AND feedback identifies which criteria lack evidence and why

#### Scenario: Evidence is stale or contradictory

- GIVEN supporting evidence older than the configurable time window or evidence contradicting the criterion
- WHEN the completion gate evaluates the criterion
- THEN that evidence does not count as sufficient
- AND the contradiction is reported

### Requirement: WAM Lifecycle Integration

The task quality contract system SHALL integrate with request processing, contract proposal and approval, implementation, completion gate evaluation, and post-completion phases.

#### Scenario: Contract flows through the lifecycle

- GIVEN a task quality contract
- WHEN the task proceeds through the WAM lifecycle
- THEN classification is enhanced during request processing
- AND `evidenceRequirements` are validated during contract proposal and approval
- AND evidence is created and linked during implementation
- AND evidence sufficiency is checked during completion gate evaluation
- AND the contract is archived and evidence retained post-completion

### Requirement: Backward Compatibility

Existing outcome contracts without `evidenceRequirements` SHALL continue to function, and the system SHALL degrade gracefully to existing verification when `evidenceRequirements` are absent without breaking existing APIs or data formats.

#### Scenario: Legacy contract without evidenceRequirements

- GIVEN an existing outcome contract without `evidenceRequirements`
- WHEN it is evaluated
- THEN it continues to function
- AND verification degrades gracefully to the existing behavior
- AND no existing API or data format breaks

### Requirement: Performance

Evidence evaluation SHALL complete within 100ms for typical task contracts and SHALL not introduce significant latency to the WAM lifecycle.

#### Scenario: Typical contract evaluation latency

- GIVEN a typical task contract
- WHEN evidence is evaluated
- THEN evaluation completes within 100ms
- AND evidence lookup is indexed to avoid significant WAM lifecycle latency

### Requirement: Reliability

The evidence gate SHALL deterministically block DONE when evidence is insufficient, reduce false DONE declarations versus baseline, and handle missing or malformed evidence gracefully.

#### Scenario: Missing or malformed evidence

- GIVEN missing or malformed evidence for a mandatory criterion
- WHEN the evidence gate evaluates the task
- THEN it deterministically blocks DONE
- AND it handles the missing or malformed input gracefully
- AND false DONE declarations are reduced compared to baseline

### Requirement: Usability

Task classification SHALL provide metadata without determining verification strictness, and error messages SHALL clearly indicate which evidence is missing and why.

#### Scenario: Classification metadata and error clarity

- GIVEN a classified task with evidence requirements
- WHEN verification runs
- THEN classification provides type, confidence, and justification without determining verification strictness
- AND evidence requirements are expressed in a clear, declarative format
- AND error messages clearly indicate which evidence is missing and why

### Requirement: Interface Changes

The system SHALL expose the task quality contract through enhanced function signatures and new data structures.

#### Scenario: Modified functions expose contract capabilities

- GIVEN the verification and policy modules
- WHEN they are invoked
- THEN `src/verification/outcome-evaluator.js` validates `evidenceRequirements` in `validateOutcomeContract` and checks evidence sufficiency in criterion evaluation
- AND `src/policy/request-classifier.js` `classifyRequest` returns a task profile with confidence and justification
- AND `src/verification/verification-policy.js` `evaluateCompletionGate` integrates evidence sufficiency checking
- AND `src/integration/orchestration.js` uses the enhanced completion gate for phase transitions

#### Scenario: TaskProfile and EvidenceRequirements data structures

- GIVEN the new data structures
- WHEN a task is classified or a criterion is defined
- THEN `TaskProfile` carries `primaryType`, `secondaryTypes`, `confidence`, `justification`, and `suggestedEvidenceProfile`
- AND `EvidenceRequirements` carries `types`, `minStrength`, and optional `sourceConstraints`

### Requirement: Security Considerations

The system SHALL not introduce new attack surfaces; evidence validation and sanitization SHALL leverage existing mechanisms and source constraints SHALL prevent inappropriate evidence sources.

#### Scenario: Evidence sources are constrained

- GIVEN a criterion with `sourceConstraints`
- WHEN evidence is validated
- THEN only evidence from permitted sources is accepted
- AND validation and sanitization reuse existing mechanisms without modifying privilege levels or access controls

### Requirement: Testing Requirements

The change SHALL be verified with unit, integration, and benchmark tests.

#### Scenario: Unit, integration, and benchmark coverage

- GIVEN the task quality contract system
- WHEN tests are executed
- THEN unit tests cover contract validation, evidence sufficiency logic, task classification accuracy, and evidence gate blocking/passing conditions
- AND integration tests cover the full lifecycle from request to completion, evidence gate integration, classification influence on contract creation, and the evidence workflow
- AND benchmark tests compare false DONE rates, false block rates, and verification cost (tokens, latency, API calls) before and after implementation

### Requirement: Acceptance Criteria

The implementation SHALL be considered complete only when the defined acceptance criteria are satisfied.

#### Scenario: Implementation acceptance

- GIVEN the completed task quality contract implementation
- WHEN acceptance is evaluated
- THEN tasks with insufficient evidence are blocked from DONE
- AND tasks with sufficient and appropriate evidence reach DONE
- AND classification provides metadata without determining verification strictness
- AND evidence gates apply rigor based on criterion-specific requirements, not task type
- AND benchmarks show reduced false DONE declarations without an unacceptable increase in false block rates or verification cost
- AND all existing tests continue to pass with no regressions
- AND edge cases (ambiguous classification, contradictory evidence, stale evidence) are handled appropriately
