# Source Synthesis Matrix

Inventory of 12 design source repositories and concept classifications (CONSENSUS, STRONG_HEURISTIC, OPTIONAL_HEURISTIC):

| Source Repo | Source File | Concept | Classification | WAM Destination | Inclusion Reason |
|---|---|---|---|---|---|
| 1. Xialiang | SKILL.md | Design Tokens & Variables | CONSENSUS | references/tokens.md | Universal requirement for semantic separation over arbitrary values |
| 2. Rajesh | references/ | Visual Hierarchy & Layout | CONSENSUS | references/composition.md | Core reading order, proximity, and layout anchors |
| 3. Leo | SKILL.md | Anti-Slop & Surface Archetypes | STRONG_HEURISTIC | references/anti-slop.md | Prevents unmotivated glassmorphism, gradients, and card spam |
| 4. Google | design/a11y | Accessibility (WCAG 2.1 AA) | CONSENSUS | references/accessibility.md | Contrast, focus visibility, keyboard navigation, aria attributes |
| 5. Junaid | templates/ | Component States & Variants | STRONG_HEURISTIC | references/components.md | Interactive hover, focus, active, disabled, loading states |
| 6. PGraeff | rules/ | Responsive & Fluid Scaling | STRONG_HEURISTIC | references/responsive.md | Breakpoints, fluid typography, flexible grids |
| 7. ReviewSrc | rules/ | Visual Review Gates | CONSENSUS | references/visual-review.md | Non-compensating verification of critical failures |
| 8. ContextSrc | docs/ | Design Context Architecture | CONSENSUS | references/design-context.md | Project-level design grounding across sessions |
| 9. DirectionSrc | guides/ | Visual Direction & Mood | STRONG_HEURISTIC | references/visual-direction.md | Typography, color palette, surface styling |
| 10. SystemSrc | specs/ | Design System Cohesion | OPTIONAL_HEURISTIC | references/design-system.md | Component token mapping & reuse |
| 11. PatternSrc | rules/ | Patterns & Flows | OPTIONAL_HEURISTIC | references/patterns.md | Multi-page user journeys and navigation |
| 12. ContentSrc | utils/ | Content & Microcopy | OPTIONAL_HEURISTIC | references/content.md | Clear UI text, empty states, error messages |
