# Methodology for External Evidence Classification

## Purpose

This document explains how external evidence is **classified**, **weighted**, and **used** in the RC1 report. It exists so that a reader can audit exactly which kind of external source backs each claim and understand why some sources are treated differently from others.

## Classification Taxonomy

Each entry in `benchmarks/evidence/sources.json` carries a `type` field. The taxonomy is intentionally coarse to avoid false precision:

- `provider` — first‑party documentation or engineering posts from a commercial API vendor. Describes mechanisms the vendor implements *for the customer* (caching, batching, rate limits). These are the least independent sources because they describe their own product.
- `academic` — peer‑reviewed papers from conferences/journals. Typically introduce a *mechanism* (an algorithm) and an *evaluation* (a benchmark).
- `open-source` — reproducible benchmark harnesses or datasets, published with code. These are the most independent sources because a third party can rerun them.
- `independent` — secondary research, surveys, or third‑party analyses not produced by a vendor or an original method paper.

## Inclusion Criteria

A source is included if **all** of the following hold:

1. It is public and citable (DOI or stable URL).
2. It reports a **numeric metric** on a **defined population** (not an unquantified marketing claim).
3. Its **methodology is described** well enough to critique (who ran it, on what, measured how).
4. It is relevant to at least one RC1 theme: prompt caching, context compression, agent multi‑turn context cost, or reproducible context benchmarking.

## The Caching Caveat (Critical)

**Provider prompt‑caching is a billing/latency optimisation, not a context‑reduction mechanism.**

When a provider reports "cached tokens are 50% cheaper", it means the *price per token* dropped. It does **not** mean fewer tokens were sent, fewer tokens were attended to, or a smaller effective context window. The model still reads the full prompt prefix on a cache hit.

WAM operates one layer up: it decides *which parts of context exist at all*. A provider cache cannot substitute for a selector, and a selector cannot claim the savings of a cache.

Consequently:

- Cached‑token figures live **only** in the **External Evidence** section of the RC1 report.
- They are **never** summed with, substituted for, or averaged into WAM's internal deterministic or empirical metrics.
- The RC1 report prints an explicit statement each time cached tokens are shown.

## Use in the RC1 Report

The RC1 report generator calls `loadEvidenceCorpus()` and renders one block per source. For each source it prints:

- The `id` and `source` (so it can be cited).
- The `type` (taxonomy tag).
- The `metric` and `population` (what was measured and on whom).
- The `relevance` (why it is in the corpus).
- The `limitations` (why it cannot be directly compared with WAM).

The report keeps a strict three‑section separation:

| Section             | Source of numbers      | Never contains                   |
|---------------------|------------------------|----------------------------------|
| InternalDeterministic | WAM validation suite  | external citations, cached tokens |
| EmpiricalReal        | WAM dry‑run evidence  | external citations, cached tokens |
| ExternalEvidence     | `sources.json` corpus  | any WAM internal metric         |

The three sections are **never merged into a single number.** If a reader sees a single headline figure in the RC1 report, it belongs to exactly one of the three sections above.

## Confidence Weighting

No numeric weight is assigned to a source; the report presents sources as **context**, not as a pooled quantitative input. Readers who want to weight sources should use the `type` field to distinguish vendor claims from independent results.