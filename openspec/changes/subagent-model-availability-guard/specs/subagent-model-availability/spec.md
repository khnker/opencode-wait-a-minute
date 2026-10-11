## ADDED Requirements

### Requirement: model-validation
The system SHALL validate the requested subagent model against the router registry pre-dispatch.

#### Scenario: model-available
WHEN a subagent requests a valid model
THEN the dispatch proceeds normally.

#### Scenario: model-unavailable-fallback
WHEN a subagent requests an unavailable model
AND a fallback tier exists
THEN the system automatically uses the fallback model.

#### Scenario: model-unavailable-no-fallback
WHEN a subagent requests an unavailable model
AND no fallback tier exists
THEN the dispatch is blocked and an actionable reason is provided.

#### Scenario: depth-limit-check
WHEN a subagent dispatch request exceeds depth limits
THEN the dispatch is refused BEFORE execution.
