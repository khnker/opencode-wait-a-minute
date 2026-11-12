# Change: Fix bash mutation classification in the execution gate

## Objective

Replace the raw-text regex used by `isMutatingToolCall` for bash with a
quote-aware shell command classifier, so the analysis execution gate blocks
real file mutations and never blocks read-only commands whose text merely
resembles a redirect or a mutating command.

## Why

In a real session, a read-only verification query

```bash
docker exec comparador-postgres psql -U comparador -d comparador_serving -At \
  -c "SELECT ... WHERE jsonb_array_length(...) >= 2 ..."
```

was classified as mutating and hard-blocked twice by the execution gate. The
agent could not run its final verification, reported a "WAM lock", and the user
had to disable WAM (`off`) to finish. The old regex scanned the raw string and
treated the `>` inside the quoted SQL as a shell redirect; it can equally match
words such as `cp` inside SQL text.

## Non-goals

- Does not change the gate lifecycle (activation, TTL, stale/orphan release).
- Does not turn the gate into a security sandbox: it keeps a conservative
  deny-list and fails open on unknown commands.
- Does not change `src/policy/discovery-classifier.js`; that classifier only
  drives advisory nudges and is out of scope.

## Core principle

Classify the command the shell would actually execute, not the raw text:
ignore everything inside single quotes, double quotes and heredoc bodies, and
only treat real shell operators as operators.
