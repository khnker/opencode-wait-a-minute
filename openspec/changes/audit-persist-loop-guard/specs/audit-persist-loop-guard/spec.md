## ADDED Requirements

### Requirement: Coalesced audit flush
The system MUST coalesce audit entries into batches and flush only when a size or time threshold is reached.

#### Scenario: Flush on size threshold
- **WHEN** the in-memory audit buffer reaches N entries or M bytes
- **THEN** the system writes a batched summary line to `default.json`

#### Scenario: Flush on time threshold
- **WHEN** a configurable idle duration passes without new audit entries
- **THEN** the system flushes the current batch immediately

### Requirement: Directory state guard
The system MUST gate trace flushes on the filesystem state of `.wam/`.

#### Scenario: Directory missing
- **WHEN** `.wam/` directory does not exist or is unwritable
- **THEN** the system skips the write and logs a warning

#### Scenario: File unchanged
- **WHEN** the existing `default.json` file has the same modification timestamp and content checksum as the current buffer
- **THEN** the system skips the write (idempotent flush)

### Requirement: Task directory cap
The system MUST enforce a maximum number of live task directories under `.wam/tasks/`.

#### Scenario: Cap exceeded
- **WHEN** the number of live task directories exceeds L
- **THEN** the system removes the oldest directories (oldest by timestamp) until under the limit

### Requirement: Summary logging
The system MUST log a single summary per batch.

#### Scenario: Batch flush log
- **WHEN** a batch is flushed
- **THEN** the system emits a summary line (e.g., `AuditPersist: flushed X entries`)
