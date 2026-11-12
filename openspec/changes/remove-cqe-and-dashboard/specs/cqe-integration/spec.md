# cqe-integration Delta

## REMOVED Requirements

### Requirement: Non-Side-Effectful Library Import
**Reason**: The plugin no longer vendors or imports `context-query-core`; there is no library import to guarantee.
**Migration**: Use native retrieval (`selectContext`, `retrieveContext` in `src/context/context.js`).

### Requirement: Repository Isolation
**Reason**: CQE indexing/querying over repository scopes is removed; native capsule retrieval does not touch repository files.
**Migration**: Use native capsule retrieval.

### Requirement: Structured Provenance & Results
**Reason**: CQE result provenance and ranking are removed together with the CQE engine.
**Migration**: Native retrieval returns capsule hits with `relevance`; no CQE metadata is produced.

### Requirement: Typed Error Handling & Fallbacks
**Reason**: The CQE failure taxonomy (`import-failed`, `timeout`, `busy`, `warming`) has no subject once CQE is removed.
**Migration**: Native retrieval is deterministic and needs no fallback chain.
