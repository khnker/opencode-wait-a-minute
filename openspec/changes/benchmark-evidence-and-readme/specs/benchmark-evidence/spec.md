## ADDED Requirements

### Requirement: README Figures Traceable To Committed Evidence

Every benchmark figure advertised in `README.md` and `README_es.md` MUST link to
the document that carries its source artifact.

#### Scenario: Context reduction figure

- **WHEN** a reader inspects the `Context Reduction` row
- **THEN** it links to `docs/benchmarks/results.md`
- **AND** the value `69.6%` equals `internalDeterministic.totalReductionPct` in
  `benchmarks/reports/rc1/metrics.json`

#### Scenario: Net input savings figure

- **WHEN** a reader inspects the `Net Input Savings` row
- **THEN** it links to `docs/benchmarks/results.md`
- **AND** the value `32.6%` derives from `netInputSavings / baselineInputTokens`
  in `benchmarks/results/2026-10-07T19-55-09.328Z/real-report.json`

### Requirement: Bilingual Evidence Parity

`README_es.md` MUST point to the same evidence documents as `README.md`.

#### Scenario: Language parity

- **WHEN** the `Reducción de Contexto` and `Ahorro Neto de Entrada` rows are read
- **THEN** each links to `docs/benchmarks/results.md`
- **AND** the deterministic-validation row links to `docs/RC1_VALIDATION.md`

### Requirement: Evidence Classes Not Merged

The documentation MUST keep deterministic, dry-run, and real-provider
measurements separate and MUST report the negative dry-run as-is.

#### Scenario: Negative dry-run reported

- **WHEN** `docs/benchmarks/results.md` reports section B1
- **THEN** the dry-run `netInputSavings` is shown as negative (`-225 tokens`)
- **AND** it is not combined with the `69.6%` deterministic figure
