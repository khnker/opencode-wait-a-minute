# Context Selection

## How WAM selects context

WAM uses a scoring mechanism to select relevant context:

1. **Task relevance**: Files related to the current task type
2. **Recency**: Recently accessed or modified files
3. **Dependency graph**: Files imported/required by relevant files
4. **Evidence needs**: Files needed for verification (tests, configs)
5. **User focus**: Files mentioned in the current prompt

## Context layers

WAM loads context in layers:
- **Core**: Essential files for the task
- **Supporting**: Dependencies and configuration
- **Evidence**: Test files and verification scripts
- **Extended**: Broader repository for exploration (if needed)

## Related documentation

- [Architecture Overview](overview.md)
- [Task Lifecycle](task-lifecycle.md)
