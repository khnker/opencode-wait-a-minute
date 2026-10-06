# Persistence

## What persists in WAM?

WAM persists:
- **Task state**: Between turns of the same task
- **Evidence**: Test results, build artifacts, logs
- **Configuration**: User and project settings
- **Skill metadata**: Cached skill selections and scores

## What does not persist?

WAM does not persist:
- **Full repository context**: Reloaded as needed per task
- **Intermediate builds**: Cleared between verification attempts
- **User prompts**: Only the derived task state persists

## Storage mechanism

WAM uses:
- In-memory storage for active task state
- File-based storage for evidence (under .wam/)
- JSON configuration files

## Related documentation

- [Architecture Overview](overview.md)
- [Runtime](runtime.md)
