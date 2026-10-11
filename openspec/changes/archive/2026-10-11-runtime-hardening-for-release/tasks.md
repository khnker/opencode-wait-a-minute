# Tasks: Runtime Hardening for Release

## 1. ESM correctness
- [x] 1.1 Remove incompatible runtime `require()` usage from ESM execution paths.
- [x] 1.2 Replace it with static or otherwise ESM-compatible imports.
- [x] 1.3 Remove dead compatibility helpers created solely for old loading path.

## 2. Strategy Continuity
- [x] 2.1 Add test that activates persisted strategy.
- [x] 2.2 Reach capability loading and candidate selection from clean Node process.
- [x] 2.3 Assert path completes without module-loader errors.

## 3. Package verification
- [x] 3.1 Verify packed tarball loads same production entry point.
- [x] 3.2 Add the Strategy Continuity smoke case to package verification.

## 4. Verification
- [x] 4.1 Run from `npm ci`.
- [x] 4.2 Run from the `npm pack` artifact.
- [x] 4.3 Confirm both paths pass.
