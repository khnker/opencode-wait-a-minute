# Proposal: Role-aware skills and stage reporting

## Why

The role loop already routes `ANALYST → ARCHITECT → BUILDER → REVIEWER`, but the
generic roles declare no preferred skills and the adapter only prints skill names
for the specialized roles. The model therefore receives the role contract without
the operating procedure that makes each role effective.

Users also cannot see where the loop is. The task context shows phase and
requirements, but not the current stage, and advisory contracts still reach the
task-loop controller as if approval were required.

## What changes

- Every role declares a small ordered set of preferred skills.
- The invocation adapter resolves those skills from the existing registry, injects
  their content into the role system prompt, and skips missing skills instead of
  failing.
- Skill injection is capped so one role cannot consume the whole prompt budget.
- The loop derives a user-visible stage from task state and the latest completed
  role result, and surfaces it in the N2 task context, role prompts and task-loop
  prompts.
- Advisory contract approval no longer produces a `WAIT_USER` loop decision.

## Out of scope

- Changing the role sequence itself.
- Loading every discovered skill.
- Persisting a second stage field in task state; stage is derived.
- Changing permission authorization or completion-gate enforcement.

## Research

- Anthropic Agent Skills: progressive disclosure and role-specific procedural
  knowledge. https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
- Anthropic, Building effective agents: narrow role prompts and explicit
  orchestration boundaries. https://www.anthropic.com/engineering/building-effective-agents
- OpenAI Agents SDK multi-agent patterns: handoffs and agents-as-tools.
  https://openai.github.io/openai-agents-python/multi_agent/
