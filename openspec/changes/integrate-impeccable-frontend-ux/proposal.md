# Integrate Impeccable Frontend UX

## Why

WAM currently treats every task uniformly: a frontend UX task follows the same lifecycle and closure rules as a backend refactor, with no specialized UX capability. This leaves frontend UX quality under-verified and forces users to bolt on external tooling by hand. Impeccable (https://github.com/pbakaus/impeccable, Apache-2.0, v4.5.2, commit `2f98774f86bc05563876643db37e6c37c322850f`) is an agent-oriented UX workflow that can supply specialized frontend UX prompts and commands. Integrating it as an OPTIONAL capability lets WAM delegate specialized UX work without changing its task lifecycle, orchestration, or outcome-based completion contract.

## What Changes

- Record upstream provenance for Impeccable (license, revision, supported agents, install mechanism `npx impeccable install`, command definitions, dependencies).
- Introduce an opt-in frontend UX integration layer with three explicit states: `unavailable`, `available-but-disabled`, and `enabled`.
- Delegate specialized UX work to Impeccable only when the capability is explicitly enabled and the task is a compatible frontend UX task.
- Keep all integration logic OUT of the completion gate; completion remains governed solely by the existing WAM outcome contract.
- Fall back gracefully when Impeccable is unavailable, reporting an explicit status instead of claiming an audit occurred.
- Preserve the user's existing Impeccable configuration; never overwrite it.

## Non-Goals

- Does not make Impeccable a mandatory runtime dependency.
- Does not perform network downloads at task time.
- Does not change `DONE` semantics or the outcome-based completion contract.
- Does not classify every task as a frontend UX task.
- Does not execute implicit commands outside WAM's normal permission model.
