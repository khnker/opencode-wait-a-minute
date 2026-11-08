# Design: Role-aware skills and stage reporting

## Research

- Anthropic Agent Skills: skills package procedural knowledge and are intended to
  be loaded on demand, not all at once.
  https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
- Anthropic, Building effective agents: role boundaries and explicit orchestration
  are more reliable than one large general prompt.
  https://www.anthropic.com/engineering/building-effective-agents
- OpenAI Agents SDK multi-agent patterns: a manager keeps Handoffs and shared
  state, while specialists receive a narrow brief.
  https://openai.github.io/openai-agents-python/multi_agent/
- Current WAM implementation: `resolveRoleSkills` can reuse the existing
  `discoverSkills` and `buildRegistry` pipeline; stage can be derived from
  `task.agentRun.results` and `task.phase`/`task.state`.

## Alternatives

### 1. Keep printing skill names only

Rejected. Names do not give the model the procedure, and the current behavior
already does this for the specialized roles. It also makes skill presence
unverifiable from the prompt.

### 2. Inject every discovered skill into every role

Rejected. It wastes the prompt budget, blurs role boundaries, and violates the
progressive-disclosure model in the Agent Skills guidance.

### 3. Resolve role skills through glob patterns

Rejected. Glob matching makes the role contract non-deterministic and hard to
review. An ordered allow-list per role is explicit and testable.

### 4. Persist a stage field in task state

Rejected. It creates a second source of truth that can drift from `agentRun`.
The stage is a pure projection of task state and the latest role result.

### 5. Resolve preferred skills with graceful missing IDs

Chosen. The registry already owns discovery and status. The loader walks the
role's ordered list, keeps approved skills, records missing IDs for diagnostics,
and caps total content. Role invocation stays available in projects that lack
some optional skills.

### 6. Treat advisory contracts as approved for the loop decision

Chosen. `contractApproval: "required"` keeps the existing pause. Any other mode
feeds `contractApproved: true` to the pure loop decision, so the loop continues
without inventing an approval state transition.
