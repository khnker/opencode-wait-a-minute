# Task Quality Contract Design

## Overview

This change enhances WAM's verification system to enforce quality gates based on task-specific evidence requirements rather than applying uniform verification standards to all tasks.

## Key Components

### 1. Task Quality Contract Structure

The contract extends the existing outcome contract format with explicit evidence requirements:

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
        types: EvidenceType[], // From evidence.js EVIDENCE_TYPES
        minStrength: EvidenceStrength, // From evidence.js EVIDENCE_STRENGTH
        sourceConstraints?: string[] // Constraints on evidence sources
      }
    }
  ],
  unknowns: [],
  assumptions: []
}
```

### 2. Task Profiling System

Extended request classifier that returns:
- Primary task type (research, creation, modification, debugging, review)
- Secondary types if applicable
- Confidence score (0-100)
- Justification for classification
- Suggested evidence requirements profile

### 3. Evidence Gate Logic

Enhanced completion gate that:
- Validates that all mandatory acceptance criteria have sufficient evidence
- Checks evidence strength against criterion-specific requirements
- Verifies evidence is temporally relevant (not stale)
- Detects and flags contradictory evidence
- Uses current system state for evaluation

### 4. Integration Points

1. **Request Classification** (`src/policy/request-classifier.js`)
   - Enhanced to return task profiles with confidence metrics

2. **Outcome Evaluation** (`src/verification/outcome-evaluator.js`)
   - Extended to validate evidence sufficiency per criterion
   - Added evidence strength checking

3. **Completion Gate** (`src/verification/verification-policy.js` and `src/integration/orchestration.js`)
   - Integrated evidence gate evaluation
   - Blocks DONE transition when evidence insufficient

4. **Evidence System** (`src/evidence/`)
   - Leverages existing evidence creation and evaluation
   - Uses evidence strength levels (L0-L4) appropriately

## Detailed Design

### Task Classification Enhancement

The request classifier will be enhanced to:
1. Detect primary task type using improved patterns
2. Calculate confidence based on pattern matches and context
3. Provide secondary types when multiple patterns match
4. Return justification linking classification to specific evidence

Example output:
```javascript
{
  primaryType: "creation",
  secondaryTypes: ["modification"],
  confidence: 85,
  justification: "Patterns matched: 'create', 'implement', 'build'; Context shows file modifications",
  suggestedEvidenceProfile: {
    creation: {
      artifactExists: { strength: "L3_DIRECT", types: ["TOOL_OUTPUT", "TEST_RESULT"] },
      behaviorVerified: { strength: "L3_DIRECT", types: ["TEST_RESULT", "OBSERVATION"] }
    }
  }
}
```

### Evidence Requirements by Criterion Type

Each acceptance criterion will specify evidence requirements rather than relying on task type:

```javascript
{
  id: "artifact-exists",
  description: "The created artifact exists in the expected location",
  mandatory: true,
  evidenceRequirements: {
    types: ["TOOL_OUTPUT", "TEST_RESULT"], // ls, stat, test file existence
    minStrength: "L3_DIRECT", // Direct observation/verification
    sourceConstraints: ["filesystem-check", "test-execution"]
  }
}
```

### Evidence Gate Evaluation Logic

The completion gate will:
1. Retrieve all evidence associated with the task
2. For each mandatory criterion:
   - Find evidence supporting that criterion
   - Check if any evidence meets the strength requirement
   - Verify evidence is not stale (within time window)
   - Check for contradictory evidence
3. If any mandatory criterion lacks sufficient evidence, block DONE
4. Return specific evidence gaps for reporting

### State Management

The system will leverage WAM's existing state tracking:
- Task state in `.wam/task-state.json`
- Evidence storage in `.wam/evidence/`
- Contract persistence in `.wam/context/`
- No duplication of existing mechanisms

## Data Flow

1. User request received
2. Request classified → task profile generated
3. Task proposed → outcome contract created (may incorporate task profile hints)
4. Contract approved → implementation begins
5. During implementation:
   - Evidence created and linked to criteria
   - Task state updated
6. Completion attempted:
   - Evidence gate evaluates current evidence against contract
   - If sufficient → DONE allowed
   - If insufficient → BLOCKED with specific missing evidence reported
7. Post-DONE:
   - Contract may be archived/synced to main specs
   - Evidence retained for audit

## Error Handling

- Ambiguous classification: Maintains rigorous evidence requirements regardless
- Insufficient evidence: Returns BLOCKED with specific missing evidence details
- Contradictory evidence: Flags as unresolved until clarified
- Stale evidence: Treated as insufficient for time-sensitive criteria
- Missing criteria: Treated as insufficient evidence

## Performance Considerations

- Evidence evaluation optimized with indexing
- Time-bound evidence staleness checking
- Caching of frequent evidence lookups
- Degradation path to existing verification if new system fails

## Security Considerations

- No new attack surfaces introduced
- Leverages existing evidence validation and sanitization
- Evidence source constraints prevent inappropriate evidence use
- No privilege escalation possibilities

## Backward Compatibility

- Existing contracts continue to work (evidenceRequirements optional)
- Existing verification logic preserved as fallback
- No changes to existing API contracts
- Gradual adoption possible

## Testing Strategy

### Unit Tests
- Contract validation with various evidence requirement formats
- Evidence sufficiency checking logic
- Task classification accuracy and confidence calculation
- Evidence gate blocking/passing conditions

### Integration Tests
- Full lifecycle with task quality contract
- Evidence gate integration with completion gate
- Task classification influence on contract creation
- Evidence creation and linking workflow

### Benchmark Tests
- Comparison of false DONE rates before/after
- Measurement of false block rates
- Verification cost (tokens, latency) analysis
- Task-type-specific effectiveness measurements

## Implementation Phases

### Phase 1: Contract Structure and Classification
- Extend outcome-evaluator.js contract validation
- Enhance request-classifier.js with profiling
- Add task quality contract tests

### Phase 2: Evidence Gate Implementation
- Modify completion gate logic for evidence checking
- Update orchestration.js integration
- Add evidence gate tests

### Phase 3: Testing and Benchmarking
- Create comprehensive test suite
- Run benchmarks comparing old/new behavior
- Performance optimization
- Documentation updates

## Dependencies

- Uses existing evidence system (src/evidence/)
- Uses existing outcome evaluator (src/verification/outcome-evaluator.js)
- Uses existing verification policy (src/verification/verification-policy.js)
- Uses existing orchestration (src/integration/orchestration.js)
- Uses existing request classifier (src/policy/request-classifier.js)

## Migration Path

Existing tasks continue to work unchanged. New tasks can opt-in to the enhanced verification by:
1. Using the enhanced request classifier (optional)
2. Creating task quality contracts with explicit evidence requirements
3. The system gracefully degrades to existing verification for contracts without evidenceRequirements

## Future Extensions

- Machine learning-assisted task classification
- Evidence strength learning from historical task outcomes
- Adaptive evidence requirements based on task complexity
- Cross-task evidence sharing and reuse