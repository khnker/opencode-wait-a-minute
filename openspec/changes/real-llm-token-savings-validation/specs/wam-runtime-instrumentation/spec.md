## ADDED Requirements

### Requirement: Instrumentation
The core runtime MUST be instrumented to track assembly, snapshot, and fast-path utilization without altering operational behavior.

#### Scenario: Telemetry Emission
- **WHEN** WAM processes tasks
- **THEN** it emits telemetry counters (`Context_assembled`, `Snapshot_hit`, etc.) to the configured sink
