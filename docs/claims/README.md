# Claims

WAM claims are documented independently from the README so each statement can be
traced to implementation, tests and, where applicable, measurements.

## Core claims

1. [Deterministic Control](deterministic-control.md)
2. [Task State](task-state.md)
3. [Context Management](context-management.md)
4. [Skill Selection](skill-selection.md)
5. [Task Isolation](task-isolation.md)
6. [Verification](verification.md)
7. [Less Guessing](less-guessing.md)

## Evidence model

Each claim should identify:

- implementation;
- automated tests;
- benchmark evidence, when applicable;
- current evidence status;
- unresolved validation gaps.

Evidence statuses:

| Status | Meaning |
| --- | --- |
| Implemented | Mechanism exists |
| Tested | Automated behavioral coverage exists |
| Measured | Reproducible quantitative evidence exists |
| Observed | Observed in a specific execution |
| Design target | Intended behavior without sufficient outcome evidence |

A claim must never be assigned a stronger status than its evidence supports.
