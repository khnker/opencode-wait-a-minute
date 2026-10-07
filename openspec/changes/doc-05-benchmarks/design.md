# Design: Benchmark Documentation

## Approach

Separar tres clases de evidencia y nunca fusionarlas en un número único.

| Clase | Propósito |
| --- | --- |
| Internal deterministic | Validar mecanismos y comportamiento determinista |
| Empirical provider execution | Medir input/output real de modelo/provider |
| External evidence | Precedente de mecanismo |

## Metrics

```
context reduction = baselineInputTokens - wamInputTokens
wam overhead      = wamOverheadTokens
net input savings = baselineInputTokens - wamInputTokens - wamOverheadTokens
```

## Accounting rules

- Input y output tokens permanecen separados.
- `Math.ceil(text.length / 4)` es un estimador, no tokenizer de provider.
- Provider caching no se mezcla con context reduction.

## Scope

README, methodology, results, limitations, RC1.

## Validation Strategy

Leer `benchmarks/reports/rc1/metrics.json` y `manifest.json` antes de actualizar
results.md; no inventar ni normalizar valores.

## Risks

- Ocultar el dry-run negativo: mantenerlo visible.
- Convertir context reduction en token savings: mantener separado.
