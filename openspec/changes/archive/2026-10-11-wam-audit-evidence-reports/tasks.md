# Tasks: WAM Audit Evidence Reports

## 1. Renderer
- [x] 1.1 Add report renderer consuming the audit JSON only.
- [x] 1.2 Implement deterministic, ordered Markdown output.
- [x] 1.3 Implement secret redaction.

## 2. Per-project report
- [x] 2.1 Implement header and coverage sections.
- [x] 2.2 Implement verdict summary and per-task table.
- [x] 2.3 Implement per-task detail with cited evidence.
- [x] 2.4 Render `UNKNOWN` when a verdict has no evidence.

## 3. Global index
- [x] 3.1 Implement index with per-project verdict counts and links.
- [x] 3.2 Aggregate coverage and orphan counts.

## 4. Reproducibility
- [x] 4.1 Document exact generation command in index and each report.
- [x] 4.2 Verify byte-identical regeneration on a clean checkout.

## 5. Verification
- [x] 5.1 Implement all required design scenarios as tests.
- [x] 5.2 Verify false-success and orphans are surfaced.
- [x] 5.3 Verify redaction on token-like evidence.
