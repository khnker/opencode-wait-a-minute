# Context

## What is context in WAM?

Context is the information available to the agent for decision-making. WAM manages:
- **Repository context**: File contents, structure, dependencies
- **Task context**: Current state, requirements, evidence
- **Conversation context**: Previous turns, clarified points
- **Skill context**: Available capabilities, usage instructions

## Context selection

WAM selects context based on:
- Current task state
- User prompt
- Required skills
- Evidence needs

## Related documentation

- [Context Management](context-management.md)
- [Tasks](tasks.md)
