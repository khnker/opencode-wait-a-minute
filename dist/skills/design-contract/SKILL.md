---
name: design-contract
description: design system contracts, token plans, anti-slop rules, state definitions, and critique loops
license: MIT
compatibility: opencode, claude-code
---

# Design Contract & System Governance

## Contract Requirements

1. **Design contract**: document layout, interactions, and constraints in
   `.opencode/contracts/design.json` before implementation.
2. **Token plan**: use design tokens (Tailwind config, CSS variables). No magic values.
3. **Anti-slop**: no nested CSS overrides, no ad-hoc "quick fix" styles; follow established
   layout patterns.
4. **States**: define loading, error, success, hover, and active explicitly.

## Critique Loop

Before finalizing a UI task:

1. **Self-audit** the implementation against the design contract.
2. **Detect drift** in layout, spacing, and styling.
3. **Refactor** drift immediately.
4. **Validate**: mark "Contract Compliant" only when drift is zero.
