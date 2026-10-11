# Tasks: Skill Lifecycle & Composition
## 1. Contract
- [x] 1.1 Define SKILL.md frontmatter schema (`inputs`,`outputs`,`requires`,`optional`,`fallback`)
- [x] 1.2 Define artifact/observation handle type
## 2. Activation graph
- [x] 2.1 Build DAG from `requires`
- [x] 2.2 Topological sort + cycle detection (reject cycles)
- [x] 2.3 Precondition check (required outputs present)
## 3. Execution
- [x] 3.1 Run skills sequentially, passing artifacts by id
- [x] 3.2 Persist executed-skill graph per task
- [x] 3.3 Preserve WAM state across transitions
## 4. Tests
- [x] 4.1 Sequence of >=2 skills with recorded graph
- [x] 4.2 Cyclic graph rejected
- [x] 4.3 Missing required dependency errors (no silent skip)
- [x] 4.4 Absent optional skill does not block
