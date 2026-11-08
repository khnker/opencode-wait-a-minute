# No Slop UI (Anti-Slop Guidelines)

Prevent interface degradation (slop) by enforcing strict design standards and quality gates.

## When to Activate

- When refactoring "quick fixes" or accumulated technical debt in UI
- When reviewing new component PRs or implementations
- Any time "slop" is detected: nested overrides, magic values, or layout drift
- Before finalizing design contracts or UI implementations

## Anti-Slop Core Rules

1. **No Magic Values**: Use established design tokens (Tailwind classes or CSS variables); arbitrary pixel/rem values, off-grid tweaks, and one-off styles are slop.
2. **No Nested Overrides**: Absolute ban on deep CSS nesting (`.a .b .c .d`). All styles should be scoped to the component level or use global utility classes.
3. **Contract Fidelity**: Implementation must match the design contract exactly. If the design needs changing, update the contract first, do not "fix it in the CSS".
4. **State Completeness**: Every component must define all applicable states. If a state is missing, it is "slop".

## Enforcement Workflow

- **Detect**: Flag magic values, nested overrides, or inconsistent spacing.
- **Isolate**: Create a temporary fix or token if none exists.
- **Standardize**: Move the fix into the design system/Tailwind config.
- **Refactor**: Remove the temporary/hacked code.
