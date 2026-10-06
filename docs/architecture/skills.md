# Skills

## How WAM handles skills

WAM treats skills as capabilities that can be loaded on demand. Skills are:
- **Discoverable**: From npm, local paths, or configuration
- **Versioned**: Tracked for compatibility
- **Tagged**: By capability, domain, and complexity
- **Loadable**: Only when needed for a task

## Skill selection process

1. **Task analysis**: Determine task type and requirements
2. **Skill matching**: Find skills matching the task profile
3. **Scoring**: Rank skills by relevance and confidence
4. **Loading**: Load top-scoring skills into the agent context
5. **Caching**: Cache selections for similar tasks

## Related documentation

- [Architecture Overview](overview.md)
- [Runtime](runtime.md)
