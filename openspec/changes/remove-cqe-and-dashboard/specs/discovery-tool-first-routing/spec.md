# discovery-tool-first-routing Delta

## MODIFIED Requirements

### Requirement: discovery-nudge
The system SHALL emit an actionable nudge suggesting a dedicated native tool for read-only discovery.

#### Scenario: Emit nudge for read-only discovery
- **WHEN** a user executes a bash command identified as read-only discovery
- **THEN** the system suggests the corresponding specialized native tool (`grep`, `glob`, or `read`) rather than blocking
