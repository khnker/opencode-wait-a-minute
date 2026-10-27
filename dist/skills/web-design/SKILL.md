# Web Design Context System SKILL

Routing and activation skill for UI/Frontend development tasks in WAM.

## When to Activate

- Designing or implementing user interfaces, pages, flows, or components
- Working with design systems, design tokens, responsive layouts, or accessibility
- Performing visual reviews, anti-slop checks, or handling `DESIGN.md`

## Workflow

1. **Pre-flight Classification**: `classifyDesignTask(prompt)` determines UI task category (13 categories).
2. **Context Assembly**: `loadDesignContext(root)` discovers `DESIGN.md` and loads minimum sufficient references into the `design` axis.
3. **Execution**: Agent implements UI changes using semantic tokens (`color.action.primary`) over raw values (`#3B82F6`).
4. **Verification**: Visual review gates and anti-slop checks validate output against principles.

## References

- `references/design-context.md`
- `references/visual-direction.md`
- `references/design-system.md`
- `references/tokens.md`
- `references/composition.md`
- `references/components.md`
- `references/patterns.md`
- `references/states.md`
- `references/responsive.md`
- `references/accessibility.md`
- `references/anti-slop.md`
- `references/visual-review.md`
- `references/content.md`
