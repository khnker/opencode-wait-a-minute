# Design: Release Integrity and CQE Distribution

## Overview
Ensure WAM is independently installable from an npm package without reliance on development checkout structure.

## Key Design Decisions

### CQE Dependency Strategy
1. **Published Package First**: Prefer `context-query-core` as a published npm dependency
2. **Bundled Fallback**: If experimental, include CQE source in WAM's `files` array
3. **Explicit Opt-in**: Document required modes when CQE unavailable
4. **Fail-Open with Guard**: Disable CQE features gracefully, never silent fallbacks

### Package Verification Script (`scripts/verify-package.mjs`)
- `npm pack` → temp dir → install → import → instantiate → run hooks → verify CQE mode → cleanup
- Must handle missing `installedRoot` by resolving effective path or failing explicitly
- Check for all critical runtime files: skills/, configs/, scripts/, benchmarks/

### Published Artifact Content
- `package.json` `files` array must include: `src/`, `scripts/`, `skills/`, `benchmarks/`
- No `../context-query-core` relative paths that resolve outside package
- `package-lock.json` frozen for reproducibility

### CI Integration
- Add single `npm run bench:verify` or similar step to existing workflow
- Fail the job if verification exits non-zero
- Do not duplicate full test suite; just verify distributable artifact

## Test Matrix
1. Clean install from npm pack
2. Import and instantiate from tarball
3. Run real hooks with minimal fixtures
4. Verify CQE enabled/disabled/absent behavior
5. Exit cleanly (temp dir cleanup) even on failure

## Acceptance Criteria (from spec.md)
- [ ] Paquete funciona fuera del checkout original
- [ ] No depende de `../context-query-core` salvo inclusión explícita
- [ ] No se omiten errores de instalación/importación
- [ ] CI verifica artefacto distribuible, no solo código fuente