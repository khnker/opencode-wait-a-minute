## ADDED Requirements

### Requirement: Tolerant agent result JSON parsing

The agent result parser MUST accept a single fenced JSON object and JSON objects
containing raw control characters inside string literals. It MUST tolerate
surrounding prose and MUST still reject text with no parseable JSON object.

#### Scenario: Fenced JSON with a raw newline in a string

- **GIVEN** a child agent response containing one fenced JSON object
- **AND** a string value with a literal raw newline or other control character
- **WHEN** `parseAgentResultText` parses the response
- **THEN** it returns the parsed object
- **AND** the string value preserves the intended newline

#### Scenario: JSON object surrounded by prose

- **GIVEN** an agent response with prose before and after a JSON object
- **WHEN** `parseAgentResultText` parses the response
- **THEN** it returns the JSON object

#### Scenario: Prose without a JSON object

- **GIVEN** an agent response containing no parseable JSON object
- **WHEN** `parseAgentResultText` parses the response
- **THEN** it throws `AgentInvocationError`
- **AND** the error code is `INVALID_RESULT`
- **AND** the message is `agent response is not valid JSON`

#### Scenario: Already-valid JSON

- **GIVEN** an agent response containing a valid JSON object
- **WHEN** `parseAgentResultText` parses the response
- **THEN** it returns the parsed object unchanged
