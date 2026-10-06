# Less Guessing

## Claim

WAM helps the agent identify important decisions that should be clarified instead of silently invented.

## What this means

An agent given a task typically makes hidden assumptions about:
- Repository structure
- User intent
- Available dependencies
- Configuration expectations

WAM surfaces these assumptions before execution begins.

## How WAM does it

WAM's pre-flight hook analyzes the user prompt and asks:
1. What is the user actually asking for?
2. What is already known vs. assumed?
3. What remains unknown?
4. What type of task is this?

If assumptions are significant, the agent asks clarifying questions before proceeding.

## Evidence

- Implementation: `src/pre-flight/`
- Unit tests: `tests/unit/pre-flight/`
- E2E scenarios: `tests/e2e/pre-flight/`

## Limitations

WAM can only surface assumptions it is programmed to recognize. Novel domain scenarios may not be caught.

## Related documentation

- [Task State](task-state.md)
- [Context Management](context-management.md)
