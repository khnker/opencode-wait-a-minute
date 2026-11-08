# Design: Fix task agent JSON parsing

## Research

- RFC 8259, *The JavaScript Object Notation (JSON) Data Interchange Format*:
  https://www.rfc-editor.org/rfc/rfc8259 — Section 7 requires control characters
  (U+0000 through U+001F) inside strings to be escaped; raw newlines are invalid
  JSON even when the surrounding object is otherwise well formed.
- `JSON.parse` implements RFC 8259 strictly, so a single unescaped newline in any
  string value fails the entire response.

## Alternatives

- **A. Strict parse plus retry prompt.** Reject the response and re-prompt the
  child agent with a repair instruction. Rejected: burns tokens on every failure,
  can loop when the model repeats the same formatting mistake, and delays the
  task loop.
- **B. Tolerant balanced-object extraction plus control-character escaping.**
  Chosen: deterministic, local to the parser, no extra model calls, and bounded
  to responses that already contain a JSON object. Raw control characters are
  escaped only inside string literals so legitimate backslash escapes survive.
- **C. Add a JSON repair dependency.** Rejected: introduces a new dependency for
  a narrow, well-understood failure mode and increases supply-chain surface.

## Decision

`parseAgentResultText` strips a single code fence as today, then tries
`JSON.parse` on the stripped text followed by every balanced `{...}` candidate.
Each candidate is tried raw and with raw control characters escaped inside JSON
strings. The first successful parse is returned. If nothing parses, the existing
`AgentInvocationError` with code `INVALID_RESULT` and message
`agent response is not valid JSON` is thrown, so prose without a JSON object still
fails loudly.

## Risks

- **Over-acceptance.** Balanced extraction makes prose wrapping a small object
  parseable. This is intentional for surrounding prose; text with no object at
  all still throws.
- **Accidental escaping of prose.** Escaping only applies inside string literals
  tracked by quote state, so braces and wording outside strings are untouched.
- **Multiple objects.** The first parseable object wins; later objects are not
  considered once one succeeds.
