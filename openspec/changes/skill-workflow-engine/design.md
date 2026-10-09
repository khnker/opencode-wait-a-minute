# Design: Workflow Engine
## Skill vs Workflow
A skill = atomic capability. A workflow = composition of skills with control flow.
## Definition (YAML)
workflow: debug
steps:
  - skill: investigate
    required: true
  - skill: reproduce
    required: true
  - skill: root-cause-tracing
    required: true
  - skill: verify
    required: true
  - skill: simplify
    condition: "complexity_detected"
## Step modifiers
required | optional | conditional | parallel | retry | fallback
## State
Persisted per `(taskId, workflowId)`: current step, visited steps, retries, branch outcomes.
Resumable across sessions.
## Retry
Bounded retries with an explicit max; a step that exhausts retries runs its fallback or the
workflow fails explicitly (never an infinite loop).
## Examples
DEBUG: investigate -> reproduce -> identify-root-cause -> implement-fix -> verify
REVIEW: scope -> inspect -> challenge -> evidence -> verify
## Decisions
- Workflows are opt-in; no universal mandatory workflow.
- The final step of any workflow MUST be a verification step (CH-05).
