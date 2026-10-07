# Change: Validation Documentation

## Why

La premisa de WAM no tiene un documento de validación que describa cómo se
prueba mediante perturbación causal, ni una matriz que distinga cambios
relevantes de irrelevantes. Validar por existencia de features no demuestra la
premisa.

## What Changes

- Crear `docs/validation/premise.md`.
- Crear `docs/validation/causal-decision-matrix.md`.

## Non-goals

- No duplicar tests existentes; referenciarlos.
- No fabricar resultados PASS.

## Expected Result

Estrategia de validación causal con fixtures deterministas y matriz de
perturbación marcada PASS/FAIL/NOT IMPLEMENTED.

## Validation

- [ ] Ambos documentos existen.
- [ ] La matriz cubre las 8 variables requeridas.
- [ ] Se referencian los tests existentes equivalentes.

## Program

- Change paraguas: `documentation-improvement`
- Prioridad: P1
