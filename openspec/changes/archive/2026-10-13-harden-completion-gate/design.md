<artifact id="design" change="harden-completion-gate" schema="spec-driven">

<task>
Create the design artifact for change "harden-completion-gate".
Technical design document with implementation details
</task>

<dependencies>
Read these files for context before creating this artifact:

<dependency id="proposal" status="done">
  <path>/home/nicolas/dev/wait-a-minute-plugin/openspec/changes/harden-completion-gate/proposal.md</path>
  <description>Initial proposal document outlining the change</description>
</dependency>
</dependencies>

<output>
Write to: /home/nicolas/dev/wait-a-minute-plugin/openspec/changes/harden-completion-gate/design.md
</output>

<instruction>
Create the design document that explains HOW to implement the change.

When to include design.md (create only if any apply):
- Cross-cutting change (multiple services/modules) or new architectural pattern
- New external dependency or significant data model changes
- Security, performance, or migration complexity
- Ambiguity that benefits from technical decisions before coding

Sections:
- **Context**: Background, current state, constraints, stakeholders
- **Goals / Non-Goals**: What this design achieves and explicitly excludes
- **Decisions**: Key technical choices with rationale (why X over Y?). Include alternatives considered for each decision.
- **Risks / Trade-offs**: Known limitations, things that could go wrong. Format: [Risk] → Mitigation
- **Migration Plan**: Steps to deploy, rollback strategy (if applicable)
- **Open Questions**: Outstanding decisions or unknowns to resolve

Focus on architecture and approach, not line-by-line implementation.
Reference the proposal for motivation and specs for requirements.

Good design docs explain the "why" behind technical decisions.
</instruction>

<template>
<!-- Use this as the structure for your output file. Fill in the sections. -->
## Context

<!-- Background and current state -->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->

**Non-Goals:**
<!-- What is explicitly out of scope -->

## Decisions

<!-- Key design decisions and rationale -->

## Risks / Trade-offs

<!-- Known risks and trade-offs -->
</template>

<success_criteria>
<!-- To be defined in schema validation rules -->
</success_criteria>

<unlocks>
Completing this artifact enables: tasks
</unlocks>

</artifact>
