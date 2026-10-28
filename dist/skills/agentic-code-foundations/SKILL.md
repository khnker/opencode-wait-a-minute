---
name: agentic-code-foundations
description: Minimal engineering rules for code that humans and agents can understand, maintain, and change safely. Apply when writing, refactoring, or reviewing code.
---

# Agentic Code Foundations

Make the code obvious. Make every abstraction earn its cost. Preserve the context needed to change it safely.

## Code
- Prefer clarity over cleverness.
- Prefer explicit intent over implicit behavior.
- Keep responsibilities cohesive and dependencies visible.
- Reuse existing patterns. Preserve established architecture.
- Abstract only to reduce real complexity or isolate a meaningful boundary.
- Do not build for hypothetical needs.
- Fewer lines do not always mean simpler code.

## Architecture
- Keep each responsibility where it belongs.
- Separate concerns that change independently.
- Avoid layers that only forward calls.
- Do not couple unrelated rules through shared abstractions.
- Preserve contracts and invariants.

## Agent-readable context
- Make intent discoverable through names, types, and structure.
- Encode constraints in code and tests where practical.
- Never leave essential knowledge only in conversation history.
- Comment only what the code cannot express: rationale, invariants, constraints, or consequences.
- Keep comments concise, specific, and close to the code.
- Remove comments that no longer hold true.

## Shortcuts
Document meaningful limitations:

`shortcut: <limitation>; upgrade when <condition>`

## Never sacrifice
- Correctness.
- Security and boundary validation.
- Data integrity and meaningful error handling.
- Accessibility and compatibility.
- Explicit requirements.

Every line, layer, and comment must justify its existence.
