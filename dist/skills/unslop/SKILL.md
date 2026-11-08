# Unslop (UI anti-slop redline)

Turn vibecoded, AI-looking UI into a designed interface with its own character.
Keep features, content and section order; make every size, color, word and image
deliberate.

## When to use

- A screen looks generated: purple gradients, glows, emoji labels, shouty copy,
  uneven spacing, arbitrary pixels.
- Redline review before shipping a frontend screen.
- Frontend/UX implementation or review passes.

## Workflow (one pass at a time)

1. Diagnose the slop with `references/signs.md`.
2. Set a direction from the product itself; choose a style that fits, not a trend
   (`references/visuals.md`).
3. Fix in this order: spacing, color, icons, copy, type, layout, details, visuals,
   motion.
4. Use the real token scales in `references/tokens.md`; never magic values.
5. Re-snapshot the screen after each pass and compare before/after.
6. Keep it accessible: contrast, focus states, reduced motion, semantic HTML.

## Hard rules

- No default purple-blue gradient, no glow, no emoji as icons or labels.
- No arbitrary pixels; use the token scale.
- No lorem/placeholder copy; write the real product words.
- Do not change features, content or section order without asking.

## References

- `references/signs.md` — slop signals to find first
- `references/visuals.md` — visual styles that work and fail
- `references/tokens.md` — spacing, color and type scales
- `references/effects.md` — code treatments (e.g. glyph imagery)
- `references/refs.md` — finished examples to learn from
- `references/upstream-skill.md` — full upstream skill text
- `scripts/snapshot.mjs`, `scripts/story.mjs` — capture and render helpers

Source: unslop by Damir Sokolovsky, CC BY 4.0 —
https://github.com/heydamir/unslop (see `NOTICE.md` and `LICENSE`).
