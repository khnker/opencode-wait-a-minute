# Design

## Top-Level Taxonomy

```text
src/
├── pillars/
│   ├── preflight/
│   ├── context/
│   ├── task/
│   ├── execution/
│   ├── verification/
│   ├── skills/
│   └── runtime/
├── orchestration/
└── shared/
```

## Pillar Ownership

### Preflight
Determines whether and how execution should begin. Owns: assessment, diagnosis, assumptions, pre-execution policy, initial decision making.

### Context
Owns context processing: classification, capture, routing, assembly, budgeting, compression, context levels.

### Task
Owns task identity and lifecycle: task creation, state, persistence, recovery, task transitions, active-task handling.

### Execution
Owns execution control: interception, guards, rate/circuit controls, execution policies, control flow directly related to execution.

### Verification
Owns correctness evidence: claims, evidence, validation, completion gates, verification state.

### Skills
Owns capability registration and discovery: skill registry, capability discovery, routing, skill metadata.

### Runtime
Owns integration with external/runtime environments: OpenCode adapters, filesystem/runtime adapters, host-specific integration, external process boundaries.

### Orchestration
Coordinates pillars. It may sequence calls between pillars but must not own their domain logic.

### Shared
Contains only infrastructure that is domain-neutral, cross-pillar, stable enough to be shared, and not semantically owned by another pillar. Examples: primitive types, generic serialization, narrowly defined infrastructure utilities.

## Dependency Direction

```text
runtime adapters
      ↓
orchestration
      ↓
pillars
      ↓
shared
```

- Pillars must not depend on orchestration.
- Shared must not depend on domain pillars.
- A shared module must not import a pillar to implement pillar-specific behavior.

## Ownership Rule

The owner of a function is determined by the semantic responsibility it implements. The number of callers does not determine ownership.

## New Pillar Rule

A new pillar requires: (1) a distinct major capability; (2) multiple internal responsibilities; (3) an independent lifecycle or invariants; (4) a meaningful architectural boundary. A single new function does not justify a new pillar.

## Deliverables

- `docs/architecture/taxonomy.md` — pillars, ownership map, dependency direction.
- `docs/architecture/ownership-map.md` — module → owner assignment, unresolved ambiguities.
