# Proposal: Fix task agent JSON parsing

## Why

The autonomous task loop blocks with
`WAM task loop: BLOCK (agent-failed: agent response is not valid JSON)` when a
child agent returns a valid JSON object inside a single code fence but one string
value contains a literal raw newline or other control character. RFC 8259 forbids
unescaped control characters inside JSON strings, so `JSON.parse` rejects the
whole response even though its structure and intent are unambiguous.

## What Changes

- Add control-character escaping that only rewrites raw `\n`, `\r`, `\t` and
  other characters below `0x20` while inside a JSON string literal, preserving
  backslash escapes and quotes.
- Add balanced `{...}` extraction that ignores braces inside strings, so a JSON
  object surrounded by prose or followed by additional text can still be parsed.
- Make `parseAgentResultText` try the stripped text and each extracted object,
  raw and control-char-escaped, returning the first successful parse.
- Keep rejecting empty responses and text with no parseable JSON object with the
  existing `INVALID_RESULT` code and `agent response is not valid JSON` message.

## Impact

- Affected specs: `agent-invocation`
- Affected code: `src/agents/invocation-adapter.js`,
  `tests/unit/agent-invocation-adapter.test.mjs`
- No new dependencies. Existing exports and signatures are unchanged.
