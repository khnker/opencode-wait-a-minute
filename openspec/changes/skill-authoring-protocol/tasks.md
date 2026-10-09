# Tasks: Skill Authoring Protocol
## 1. Docs
- [x] 1.1 Document the authoring pipeline (8 stages)
- [x] 1.2 Define the authoring record schema
- [x] 1.3 Define the `skill`/`workflow`/`reference`/`constraint` taxonomy
## 2. Rules
- [x] 2.1 Encode exclusion rules (one-off, mechanical, project-specific, duplicate)
- [x] 2.2 Duplication detector against the skill registry
## 3. Enforcement
- [x] 3.1 A new skill cannot be registered without an authoring record
- [x] 3.2 A skill classified as `workflow` is redirected to CH-04
## 4. Tests
- [x] 4.1 Duplicate skill rejected
- [x] 4.2 Mechanical rule routed to validation, not skills
- [x] 4.3 Missing authoring record blocks registration
