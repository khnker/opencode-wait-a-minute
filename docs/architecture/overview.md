# Architecture Overview

## Components

```mermaid
graph LR
    A[User Prompt] --> B[WAM Pre-flight]
    B --> C[Task Classification]
    C --> D[Skill Selection]
    D --> E[OpenCode Agent]
    E --> F[Completion Control]
    F --> G[Evidence Required]
    G --> H[Done]
```

## Layer separation

WAM operates as a prompt hook. It does not modify OpenCode internals.

## Related documentation

- [Task Lifecycle](task-lifecycle.md)
- [Context Selection](context-selection.md)
