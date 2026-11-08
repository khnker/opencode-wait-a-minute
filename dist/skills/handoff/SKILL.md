---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to the OS temp directory (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows), not the workspace.

Include verifiable current state, dependencies and blockers, an unambiguous next action, and a "suggested skills" section naming skills the next agent should call.

Reference artifacts already captured elsewhere (specs, plans, ADRs, issues, commits, diffs) by path or URL; don't duplicate their content.

Redact sensitive information: API keys, passwords, and personally identifiable information.

If the user passed arguments, treat them as the next session's focus and tailor the document accordingly.
