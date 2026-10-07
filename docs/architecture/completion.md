# Completion

## Overview

Completion is the subsystem responsible for task completion, including completion gates, evidence requirements, verification policy, and the final transition to completed state. It validates that all requirements are satisfied and the task is ready for closure.

## Mechanisms

### Execution State Machine
- **File**: `src/execution/execution-state.js`
- **Purpose**: Manages execution states and transitions
- **States**: `INITIALIZING`, `INVESTIGATING`, `EXECUTING`, `VERIFYING`, `COMPLETED`, `BLOCKED`, `WAITING_AUTHORIZATION`, `FAILED`
- **Legal transitions**: Strict state transition rules defined in invariants.md
- **Completion transition**: `VERIFYING` → `COMPLETED` when all requirements verified

### Verification Policy
- **File**: `src/verification/verification-policy.js`
- **Responsibility**: Owns verification lifecycle and policy
- **Mechanism**: Policy chain for verification progression
- **Policy chain**: `SCOPE → INVESTIGATE → ACTION → DEBUG → OBSERVE → VERIFY → REVIEW → COMPLETION`
- **Functions**:
  - `validatePolicyFlow()` - Rejects invalid policy transitions
  - `getNextPolicy()` - Returns next policy in chain or null at end
  - `checkPolicyPreconditions()` - Gates policy entry based on preconditions

### Release Gate
- **File**: `src/integration/release-gate.js`
- **Purpose**: Controls task release and completion
- **Mechanism**: Validates completion criteria before task closure
- **Criteria**:
  - `completionIntegrity` - Every task has a VERIFIED completion report
  - `allRequirementsSatisfied()` - All requirements met with valid evidence
  - `hasVerifiedCompletion()` - Task has verified completion evidence
- **Process**: Multi-step completion validation with rollback capability

### Execution Assessment
- **File**: `src/policy/execution-assessment.js`
- **Purpose**: Assesses execution readiness
- **Mechanism**: Evaluates if task is ready for completion
- **Integration**: Works with release-gate for final validation

### Verification Policy Engine
- **File**: `src/policy/verification-policy-engine.js`
- **Responsibility**: Manages verification policy application
- **Mechanism**: Applies verification policies dynamically
- **Features**:
  - Policy versioning
  - Conditional policy application
  - Policy chain management

### Completion Evidence Processing
- **File**: `src/verification/completion-evidence.js`
- **Purpose**: Processes completion evidence
- **Mechanism**: Validates and processes completion evidence
- **Integration**: Works with release-gate for final verification

### Completion Contract
- **File**: `src/integration/message-handler.js`
- **Responsibility**: Manages completion contracts
- **Mechanism**: Stores and updates completion contracts
- **Usage**: Used by release-gate for completion validation

### Canary Deployment
- **File**: `src/integration/canary-deploy.js`
- **Purpose**: Manages completion deployment
- **Mechanism**: Validates completion deployment
- **Features**:
  - Completion rate validation
  - Error rate monitoring
  - Health check integration

## Integration

### Dependency Relationships
- **Evidence subsystem**: `src/evidence/` provides completion evidence
- **Cognition subsystem**: `src/cognition/` stores completion hypotheses
- **State machine**: `src/execution/execution-state.js` manages completion transitions
- **Release gate**: `src/integration/release-gate.js` coordinates completion validation

### Data Flow
1. **Verification → Evidence**: Verification creates completion evidence
2. **Evidence → Release gate**: Evidence validated by release-gate
3. **Release gate → State transition**: State machine transitions to COMPLETED
4. **Completion → Cognition**: Completion hypotheses created in cognition-store
5. **Cognition → Evidence**: Completion hypotheses trigger evidence creation

### Completion Process
1. **Verification phase**: Task execution and verification
2. **Evidence collection**: Evidence gathered for all requirements
3. **Gate validation**: Release-gate validates completion readiness
4. **State transition**: State machine transitions to COMPLETED
5. **Contract update**: Completion contract updated
6. **Cleanup**: Stale evidence and hypotheses cleaned up

## Completion Criteria

### Requirements
- **All requirements resolved**: Every task requirement must have valid evidence
- **Evidence completeness**: Evidence must cover all requirement aspects
- **Verification success**: All verification steps must pass
- **Policy compliance**: All verification policies must be satisfied

### Evidence Requirements
- **Verification evidence**: Evidence from verification steps
- **Completion evidence**: Evidence demonstrating task completion
- **Validation evidence**: Evidence validating completion criteria
- **Audit evidence**: Evidence for compliance and correctness

## Related Documentation
- [Architecture Overview](overview.md)
- [Task Lifecycle](task-lifecycle.md)
- [Evidence](evidence.md)
- [Cognition](cognition.md)
- [Persistence](persistence.md)