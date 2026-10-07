# Add Context Dictionary Design

## WAM Skill Integration Design

### Architecture

```
skill-loading/
├── builtinCapabilities/  (engine.js) - extended metadata
├── DEFAULT_CONSTRAINTS/  (skill-routing.js) - layer constraints
├── skills/               - 8 vendored skill dirs
│   ├── writing-for-agents/  (base)
│   ├── codebase-design/     (base)
│   ├── diagnosing-bugs/     (ondemand)
│   ├── tdd/                 (ondemand)
│   ├── handoff/             (ondemand)
│   ├── wizard/              (ondemand)
│   ├── prototype/           (ondemand)
│   └── improve-codebase-architecture/ (ondemand)
└── registry.json          (existing, also picks up new skills)
```

### Builtin Capabilities Extension (engine.js:795-819)

Each skill entry may include `loadStrategy: "base" | "ondemand"` in its metadata object. When absent, defaults to `"ondemand"`.

Key existing entries (also modified):
- `"writing-for-agents"` → added `loadStrategy: "base"`, `capabilities: ["context", "prompt", "agent"]`, triggers from description
- `"codebase-design"` → added `loadStrategy: "base"`, `capabilities: ["architecture", "deep-module"]`, triggers `["deep-module", "arquitectura"]`
- New entries added below

### Skill Routing Constraints (skill-routing.js:31-68)

Each new skill registered in `DEFAULT_CONSTRAINTS`:
- `"diagnosing-bugs"` → layers: shared, triggers included, risk high
- `"tdd"` → layers: shared, risk low
- `"handoff"` → layers: shared (context management), risk low
- `"wizard"` → layers: shared, risk medium (setup procedure)
- `"prototype"` → layers: shared, risk medium
- `"improve-codebase-architecture"` → layers: shared, risk medium

### Score Calculation (scoreSkill, engine.js:641-741)

- Base skills: score applied, but always-selected flag prevents dropping below threshold
- On-demand skills: normal scoring with weights (name=5, capability=4, keyword=3, description=2, domain=1)
- Top 3-5 selected based on rigor mode

### Skill File Layout (skills/<id>/SKILL.md)

```
---
name: skill-name
description: ...
# Possibly: disable-model-invocation: true  (user-invoked only)
---

## Purpose

...
## Triggers

- trigger phrase 1
- trigger phrase 2
```

### Vendored Skills Catalog (2 base + 6 on-demand)

**Base (always loaded):**
1. `writing-for-agents` — meta-skill: escribir/editar skills/AGENTS.md; triggers: ["escribir skill", "editar skill", "AGENTS.md"]
2. `codebase-design` — vocabulario de deep modules; triggers: ["deep module", "arquitectura de módulo", "seam"]

**On-Demand:**
3. `diagnosing-bugs` — loop diagnóstico; triggers: ["debug", "diagnose", "broken", "slow"]
4. `tdd` — escribir tests new seams; triggers: ["test", "TDD", "test-first"]
5. `handoff` — compactar sesión; triggers: ["handoff", "hand-off", "continuar después"]
6. `wizard` — setup interactiva bash; triggers: ["setup", "configurar", "credenciales", "one-shot"]
7. `prototype` — prototipo throwaway; triggers: ["prototype", "sanity-check", "state model"]
8. `improve-codebase-architecture` — scan de deepening; triggers: ["deepening", "architecture", "scan"]