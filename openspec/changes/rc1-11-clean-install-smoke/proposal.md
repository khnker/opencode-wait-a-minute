# Change: Clean Install Smoke Test

## Why
The full clean-room flow must be reproducible end to end.

## What Changes
- Flow: git checkout -> `npm ci` -> `npm pack` -> clean temp dir -> `npm install package.tgz` -> run smoke.
- No dependence on repo node_modules, untracked files, absolute paths or local config.

## Non-goals
- Using developer-local configuration.

## Expected Result
A fresh checkout reproduces the install+smoke flow deterministically.

## Validation
- [x] `npm ci` succeeds from a clean checkout.
- [x] `npm pack` succeeds.
- [x] Clean install succeeds.
- [x] Smoke passes.

## Program
- RC1 item: RC1-11 (B)
- Priority: P0
