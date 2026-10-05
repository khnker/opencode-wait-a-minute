# Tasks

## Implementation
- [ ] Case: existing task + existing valid context + existing evidence -> continuation with NO full rediscovery.
- [ ] Demonstrate WAM does not pay the full context cost again.
- [ ] Fast-path taken when preconditions hold.
- [ ] No full rediscovery executed.
- [ ] Measured cost below the full-rebuild path.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-07-continuation-fast-path --strict` passes.
