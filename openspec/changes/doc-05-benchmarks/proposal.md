# Change: Benchmark Documentation

## Why

La documentación de benchmarks no separa claramente las tres clases de evidencia
(interna determinista, empírica de provider, externa) ni las fórmulas de
context reduction / WAM overhead / net input savings. El resultado dry-run con
`netInputSavings` negativo debe permanecer visible.

## What Changes

- Crear `docs/benchmarks/README.md`.
- Crear `docs/benchmarks/methodology.md`.
- Actualizar `docs/benchmarks/results.md` desde artifacts reales.
- Actualizar `docs/benchmarks/limitations.md`.
- Actualizar `docs/benchmarks/RC1.md`.

## Non-goals

- No fusionar las clases de evidencia en un solo número.
- No fabricar un resultado para satisfacer el umbral del 60%.

## Expected Result

Documentación de benchmark que distingue contexto, tokens y costo, y que reporta
los resultados reales de `benchmarks/reports/rc1/`.

## Validation

- [ ] Fórmulas de contexto/overhead/net savings documentadas.
- [ ] Resultado determinista (69.6%) atribuido a su harness.
- [ ] Dry-run negativo visible si se reproduce.

## Program

- Change paraguas: `documentation-improvement`
- Prioridad: P1
