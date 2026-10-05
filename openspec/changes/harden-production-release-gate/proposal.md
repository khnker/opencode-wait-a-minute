# Proposal: Harden Production Release Gate

## Problem

WAM already has a release gate (`npm run gate`), but its coverage does not yet correspond exactly to the invariants that define a production-safe release.

Several important behaviors are currently covered by the general test suite rather than being explicit release invariants:

* completion/evidence enforcement;
* governance enforcement;
* task isolation;
* audit contract validation;
* package installation integrity;
* continuation fast-path behavior.

At the same time, `wam-audit` contains heuristic behavioral analysis that should not be confused with deterministic release invariants.

## Goal

Make `gate` the authoritative deterministic release gate.

A release must demonstrate that:

1. the package can be installed from the generated tarball;
2. core runtime invariants hold;
3. governance cannot be bypassed;
4. task state is isolated;
5. completion requires valid evidence;
6. audit configuration is fail-closed;
7. continuation avoids unnecessary expensive context work.

## Scope

This change covers the release gate and its deterministic checks.

## Non-goals

* Making heuristic audit classification a release blocker.
* Adding new product functionality.
* Changing WAM's runtime architecture beyond what is necessary to expose deterministic invariants.

## Expected result

`npm run gate` becomes the final machine-verifiable barrier before release.
