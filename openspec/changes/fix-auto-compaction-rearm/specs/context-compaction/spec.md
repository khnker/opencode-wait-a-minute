# Context Compaction

## ADDED Requirements

### Requirement: Auto-compaction re-arms after shrinking
The plugin MUST compact a session more than once when the token count crosses
the threshold, drops to at most half the threshold, and crosses it again.

#### Scenario: Second compaction after re-arm
- **WHEN** an assistant event crosses the auto-compaction threshold
- **THEN** the plugin calls `session.summarize` once and marks the session disarmed
- **WHEN** a later event reports a total at or below half the threshold
- **THEN** the session re-arms without summarizing
- **WHEN** a later event crosses the threshold again
- **THEN** the plugin calls `session.summarize` a second time

#### Scenario: Still above the re-arm bound
- **WHEN** a disarmed session reports a total above half the threshold
- **THEN** the plugin does not summarize and the session stays disarmed

#### Scenario: Cooldown and single flight
- **WHEN** a summarize call for the session is in flight
- **THEN** further events for that session are ignored until it completes
- **WHEN** the cooldown has not elapsed
- **THEN** the plugin does not summarize

### Requirement: Summarize is recorded as automatic
The summarize request body MUST include `auto: true`.

#### Scenario: Automatic body
- **WHEN** the plugin summarizes a session
- **THEN** the call body contains `auto: true` together with `providerID` and `modelID`

### Requirement: Summarize failures are visible
A failing summarize MUST be logged regardless of the logging configuration.

#### Scenario: Error is logged
- **WHEN** `session.summarize` throws
- **THEN** the plugin logs the message via `console.warn` and clears the in-flight marker
