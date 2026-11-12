# Design: Fix bash mutation classification in the execution gate

## Problem

`src/execution/execution-gate.js` decides whether a bash tool call mutates
files with a single regex over the raw command string:

```js
const BASH_MUTATION_RE = /...|(^|\s)(>|>>)\s*\S/;
```

Regex matching over raw text conflates shell syntax with data:

- `psql -c "SELECT ... >= 2 ..."` matches the redirect branch (`>` + `=`
  satisfies `\s*\S`) even though the comparison lives inside a quoted argument.
- SQL text containing words such as `cp` can satisfy the command branch.
- Conversely, mutations hidden inside `bash -c "..."` are not seen.

A false positive is expensive: the gate throws a `WamPolicyBlock`, the agent
cannot finish the task, and the user must disable WAM.

## Research

- POSIX Shell Command Language, quoting and redirections:
  https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html
- GNU Bash Reference Manual, Quoting:
  https://www.gnu.org/software/bash/manual/html_node/Quoting.html
- GNU Bash Reference Manual, Redirections:
  https://www.gnu.org/software/bash/manual/html_node/Redirections.html
- `shell-quote` npm package (reference implementation of shell tokenizing):
  https://www.npmjs.com/package/shell-quote

Key facts used: single quotes are literal; double quotes suppress redirection
and command separators while allowing backslash escapes; `>&`/`&=N` duplicate
file descriptors while `>`, `>>`, `>|`, `&>` write files; heredoc bodies are
data until the delimiter line.

## Alternatives

| Option | Decision | Why |
| --- | --- | --- |
| Patch the regex (`(>|>>)(?!=)`) | Rejected | Fixes only `>=`; quoted `cp`, `>` inside strings and `bash -c` remain broken. Symptom-only. |
| Reuse `classifyBash` from `discovery-classifier.js` | Rejected | Tuned for advisory discovery nudges, not blocking. Its mutation test is still a raw-text keyword regex (would match `cp` inside SQL). |
| Add the `shell-quote` dependency | Rejected | The repo has no runtime dependencies and the design rules prefer deterministic, native code. A dependency is unjustified for a bounded scanner. |
| Quote-aware scanner with a conservative deny-list | **Chosen** | Ignores quoted/heredoc data, recognizes real operators, handles nested `sh -c`/`eval`, no new dependency, testable through one small interface. |

## Decision

Add `src/execution/shell-mutation.js` exposing one function:

```js
classifyBashMutation(command) -> { mutating: boolean, reason: string }
```

Internals (not part of the interface):

1. Scan the command character by character, tracking single quotes, double
   quotes, backslash escapes and heredoc bodies.
2. Split into segments on unquoted `;`, `&&`, `||`, `|`, `&`, newline.
3. Detect unquoted output redirections (`>`, `>>`, `>|`, `&>`); ignore `>&`
   descriptor duplication, `>(` process substitution, and harmless targets
   (`/dev/null`, `/dev/stdout`, `/dev/stderr`, `/dev/tty`, `-`).
4. Resolve each segment's effective command word after environment assignments
   and common wrappers (`sudo`, `env`, `nohup`, ...).
5. Mark mutating when the command is in the deny-list, is an in-place
   `sed`/`perl`/`ruby`, a mutating `git` subcommand, a package install/remove,
   or a nested shell/`eval` whose inner script mutates.

`execution-gate.js` keeps `MUTATING_TOOLS` and the gate lifecycle; only
`isMutatingToolCall` delegates bash classification to the new module.

## Why the deny-list direction is correct

The gate only needs to stop edits while WAM analyzes a task. Blocking a clear
mutation is cheap and recoverable; blocking a read-only command is what makes
sessions dead. So the classifier positively identifies mutations and fails open
on anything it does not recognize. This preserves prior coverage (which also
only matched a fixed list) and removes the false positives.

## Risks

- A mutation expressed through an unknown tool or a wrapper flag with an
  argument can be missed (false negative). That matches prior behavior and is
  bounded by the task lifecycle.
- The scanner is a deliberate subset of shell grammar (no `$()`/backtick
  recursion). These are not required to satisfy the reported case and are
  recorded as a known limitation.
