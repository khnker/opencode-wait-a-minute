# Tasks: Skill Discovery & Context Budget
## 1. Metadata
- [x] 1.1 Formalize frontmatter (name/description/triggers/keywords)
- [x] 1.2 Validate that description describes WHEN, not the workflow
## 2. Layered loading
- [x] 2.1 Always-loaded metadata layer
- [x] 2.2 Activated SKILL.md layer
- [x] 2.3 On-need reference/resource layer
## 3. Metrics
- [x] 3.1 Compute skill_context_tokens + reference_context_tokens
- [x] 3.2 Compute total_skill_cost + activation_frequency
## 4. Budget
- [x] 4.1 Enforce budget via the existing admission mechanism
## 5. Tests
- [x] 5.1 Description triggers discovery, body still loaded for behavior
- [x] 5.2 Metrics reported per activation
- [x] 5.3 Over-budget activation admitted/rejected per policy
