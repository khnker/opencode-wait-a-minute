# Specs: Fix WAM Conversational Friction and Tests

## MODIFIED Requirements
- **Conversational Pragmatics**: The system MUST detect user frustration, irony, and repetition intent accurately, relaxing rigid contract gates when context indicates exploratory discussion rather than formal task execution.
- **Shared Understanding Alignment**: The system MUST echo verified requirements and alignment state explicitly to avoid state hallucination between LLM and user.

## ADDED Requirements
- **Real LLM Test Harness**: The test suite MUST include integration tests against a live WAM-enabled OpenCode instance to validate conversational flow and prevent regressions.
