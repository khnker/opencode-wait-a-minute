# Change: Dedupe skill injection and quiet dispatch noise

## Objective
Avoid re-injecting unchanged skill bodies every turn and stop deriving tracked
tasks from subagent dispatch prompts.

## Why
Skill routing runs on every message and base skills always win, so the same
three base bodies are re-sent each turn (observed ~3.4–3.6 k WAM tokens/turn).
Literal keyword matching also fills the on-demand slots with weakly related
skills (score 3). Separately, each `Task` dispatch creates a slug task such as
`task-router-you-are-fast-execute-this-dispatch-…`, polluting recent-change and
savings metrics.

## Non-goals
- Does not change the canonical base-skill set.
- Does not remove the on-demand skill budget (40 % of flex).
- Does not alter the registry contents.
