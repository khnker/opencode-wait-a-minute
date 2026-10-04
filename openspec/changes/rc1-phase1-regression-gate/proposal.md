# Proposal: RC1 Phase 1 — Regression & Test Gate

## Why
Establish a reproducible, strict regression and test gate covering test suite classification, shared-state isolation, false completion prevention, task lifecycle matrix, continuation matrix, admission invariants, assumption/evidence tracking, and persistence recovery.

## What Changes
- Centralized test runner / gate script with category counts and summary (`scripts/release-gate.mjs`).
- Test classification and shared-state isolation (`.wam/` isolation per test suite).
- Regression suites for completion vocabulary, task lifecycle, continuation, N0-N3 admission, budget invariants, evidence lifecycle, and persistence/recovery.
