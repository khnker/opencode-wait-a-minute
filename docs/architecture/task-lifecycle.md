# Task Lifecycle

## States

```mermaid
stateDiagram-v2
    [*] --> Unknown
    Unknown --> Understanding: User prompt
    Understanding --> Asking: Significant assumptions
    Understanding --> Implementing: Clear task
    Asking --> Implementing: Clarification received
    Implementing --> Verifying: Implementation complete
    Verifying --> Implementing: Issues found
    Verifying --> Done: Verified complete
    Done --> [*]: Task closed
    Understanding --> [*]: Cancelled
    Implementing --> [*]: Cancelled
    Verifying --> [*]: Cancelled
```

## Transitions

Each transition requires specific evidence:
- Unknown → Understanding: Repository inspection
- Understanding → Asking: Assumption analysis
- Asking → Implementing: User clarification
- Implementing → Verifying: Implementation signal
- Verifying → Done: Verification pass
- Verifying → Implementing: Verification failure

## Related documentation

- [Architecture Overview](overview.md)
- [Context Selection](context-selection.md)
