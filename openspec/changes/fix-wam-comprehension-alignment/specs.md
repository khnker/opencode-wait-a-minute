# Specs: WAM Conversational Comprehension and Alignment

## Specification
- **Requirement 1:** The WAM session handler MUST preserve full conversation history and context across state transitions (`Full` -> `Fast` -> `Partial`).
- **Requirement 2:** The task inference engine MUST validate pragmatic intent and alignment with the user's explicit goals before execution.
- **Requirement 3:** Stage recognition MUST maintain strict checkpoints to prevent goal deviation or premature stage completion.
