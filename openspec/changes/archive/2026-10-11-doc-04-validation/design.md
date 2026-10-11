# Design: Validation Documentation

## Approach

La premisa se valida por perturbación controlada: se mantiene todo constante y se
cambia una variable relevante; se verifica que la decisión cambia. Luego se
cambia una variable irrelevante; se verifica que la decisión permanece estable.

## Fixture model

```json
{
  "task": "...",
  "skills": [],
  "context": [],
  "evidence": [],
  "state": {},
  "expectedNextAction": "...",
  "expectedSkills": [],
  "expectedContext": [],
  "expectedVerification": true
}
```

## Required coverage

1. same state → same decision
2. state change → decision change
3. relevant skill change → selection change
4. relevant context change → selection change
5. evidence change → verification/completion change
6. new task → isolated context
7. completed task → state retained, no leak
8. missing evidence → completion blocked
9. sufficient evidence → completion allowed
10. irrelevant change → decision stable

## Scope

`docs/validation/premise.md`, `docs/validation/causal-decision-matrix.md`.

## Validation Strategy

Reusar tests existentes; crear solo donde falte cobertura; marcar TODO.

## Risks

- Correlación presentada como causalidad: exigir perturbación real.
- Duplicar la suite: preferir referenciar.
