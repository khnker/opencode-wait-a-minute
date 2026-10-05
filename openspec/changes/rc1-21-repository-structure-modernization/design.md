# Design: Repository Structure Modernization

## Approach
Root contains ~150 loose runtime files, tests, benchmarks and tooling, which increases cognitive load and makes change surface hard to control before RC1 freeze.

## Scope
- Inventory every root-level file/dir and classify into KEEP ROOT / MOVE src / MOVE tests / MOVE benchmarks / MOVE docs / MOVE scripts / DELETE / GENERATED.
- Introduce src/{core,cognition,assessment,context,completion,persistence,evidence,skills,cli,plugin}.
- Relocate test files under tests/ (unit, integration, e2e, fixtures, helpers).
- Relocate benchmark tooling under benchmarks/{deterministic,live,scenarios}.
- Relocate docs under docs/{architecture,guides,releases,decisions}.
- Relocate tooling under scripts/{release,benchmark,validation,dev}.
- Update all imports, package.json (files/main/scripts), README and CI references.
- No behavior change: this change is purely structural.

## Validation Strategy
- Inventory file produced and each entry classified (no UNCLASSIFIED).
- `node scripts/run-tests.mjs` exits 0.
- `npm pack` succeeds and `npm run pack:test` exits 0.
- `npm run gate` reports RC1 READY.
- No runtime module imported from the old root path (grep empty).

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
