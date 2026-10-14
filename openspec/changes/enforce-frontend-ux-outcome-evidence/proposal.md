# Enforce Frontend UX Outcome Evidence

## Why

WAM's outcome contract accepts arbitrary success claims without requiring appropriate evidence. This is particularly problematic for frontend UX tasks where evidence can be qualitative (observed defects), visual (screenshots), or analytical (user testing), but currently some claims bypass evidence validation. We need to ensure frontend UX completion claims are supported by evidence appropriate to the claim.

## What Changes

- Reuse the existing outcome contract (`src/verification/outcome-evaluator.js`) and evidence lifecycle (`src/evidence/evidence.js`).
- Associate each UX acceptance criterion with verification method(s) (static analysis, automated tests, visual inspection, human usability evaluation).
- Record baseline behavior, intended change, observed result, evidence reference, verification status.
- Distinguish static analysis from full a11y, screenshot from full usability, code diff from interaction proof.
- Treat unverified claims as unverified, not achieved.

## Non-Goals

- Does not change existing outcome contract for non-UX tasks.
- Does not modify DONE semantics or outcome lifecycle.
- Does not invent or fabricate evidence where none exists.
