# Add Frontend UX Prompt Suite — Design

## Goal

Add a versioned, independently testable Markdown prompt suite for frontend UX tasks that integrates with WAM's existing prompt catalog (`prompts/index.json`) without creating a competing system.

## Data Model

- Prompt suite location: `prompts/frontend-ux/` (directory)
- Manifest: `prompts/frontend-ux/manifest.json` (catalog of prompts with stable ids and versions)
- Prompts: Five files (`prompts/frontend-ux/diagnose.md`, `design.md`, `refine.md`, `verify.md`, `review.md`)
- Each prompt defines:
  - `id`: stable identifier (e.g., `frontend-ux-diagnose`)
  - `version`: semantic version (e.g., `1.0.0`)
  - `activation`: how prompt is triggered (e.g., `task.isFrontendUx && task.uxCapability === 'impeccable'`) 
  - `requiredInput`: expected context/data required (e.g., `DOM snapshot, user logs`)
  - `expectedOutput`: structural contract (e.g., `{ findings: [{ type, location, severity }], hypotheses: [...] }`)
  - `constraints`: non-goals and boundaries (e.g., "do not produce quantitative metrics")
  - `evidenceRequirements`: what needs to be present (e.g., "observed defect reports, not user satisfaction scores")
  - `fallback`: behavior when context is missing (e.g., "return empty findings with explanatory note")
  - `relatedTo`: references to other prompt ids for cross-linkage

## Architecture & Flow

1. **Integration Point**: The capability from `integrate-impeccable-frontend-ux` calls `prompts/frontend-ux/manifest.json` to get the prompt catalog, then loads the specific prompt based on `task.uxCapability`.
2. **Prompt Loading**: WAM's existing `prompts` subsystem reads the manifest and loads prompts dynamically based on the task's `isFrontendUx` flag and `uxCapability`.
3. **Prompt Execution**: When a frontend UX task is active, WAM loads the relevant prompt (e.g., `verify.md`) and feeds the task context into its template.
4. **Output Validation**: Each prompt's output is validated against its `expectedOutput` structural contract in the manifest; deviations are flagged.
5. **Evidence Collection**: Prompt outputs serve as evidence for frontend UX tasks and are recorded in the outcome with a reference to the prompt id/version.

## File Structure

```
prompts/frontend-ux/
  manifest.json
  diagnose.md
  design.md
  refine.md
  verify.md
  review.md
```

## Implementation Notes

- Manifest must be JSON with a stable schema and include a `$schema` reference for validation.
- Prompt frontmatter includes `id`, `version`, `activation`, `description`, `evidenceRequirements`, `nonGoals`.
- Use the same markdown templating conventions as other WAM prompts.
- Prompts are written in Markdown with Clear sections: `Observed`, `Hypothesis`, `Evidence`, `Limitations`, `Next Steps`.
- All prompts must distinguish observed defects from hypotheses.
- Do NOT include UI mockups, quantitative metrics, or user satisfaction scores.
