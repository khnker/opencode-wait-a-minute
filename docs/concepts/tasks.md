# Tasks

## What is a task in WAM?

A task is a discrete unit of work requested by the user. WAM classifies tasks into types:

- **Exploration**: Information gathering (read-only)
- **Implementation**: Code changes, refactoring, feature work
- **Debugging**: Issue diagnosis and resolution
- **Architecture**: Structural or design decisions

## Task state

Tasks progress through states:
1. **Unknown** → Initial state, no context loaded
2. **Understanding** → Repository inspected, facts gathered
3. **Asking** → Clarification questions posed
4. **Implementing** → Code changes in progress
5. **Verifying** → Changes being validated
6. **Done** → Task complete with evidence

## Related documentation

- [Requirements](requirements.md)
- [Evidence](evidence.md)
