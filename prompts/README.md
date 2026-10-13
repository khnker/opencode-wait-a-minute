# WAM Prompts

Centralized, versioned system prompts injected into the model by the WAM
plugin. Every string WAM sends to the model lives here as Markdown, so prompts
are reviewable, diffable and testable in isolation from code.

## Layout

```
prompts/
  index.json        catalog: id -> path, status, consumers, testRefs
  nudges/           soft suggestions (tool-choice, redundancy)
  notices/          state/flow messages (blocked, pending, gates)
  injections/       context injected as wam parts (delegation, backlog, N2)
  policies/         persistent policy rule lists (scope, verify, simplify)
  questions/        generated questions for the user
  *.md              prompt bodies with optional frontmatter
```

Categories map to the first segment of the prompt id (`injection.backlog_item`
-> `injections/backlog-item.md`).

## Prompt file format

```markdown
---
id: injection.backlog_item
status: active
---

  {{id}}: {{title}}
```

- `---` frontmatter is optional and stripped before use.
- Body is returned verbatim; only `{{var}}` placeholders are replaced.
- `responsibility` states the single duty each prompt owns (what behavior WAM
  enforces and when it must be emitted). It is documentation only.
- `status` is descriptive (`active` | `candidate`); the loader does not enforce it.
- Final trailing newline is trimmed; internal blank lines are preserved.

## Interpolation

`loadPrompt(id, vars)` replaces every `{{var}}` (all occurrences, global) and
throws if a referenced variable is missing. Names allowed: `[A-Za-z0-9_.-]`.

```js
import { loadPrompt } from "../prompts/loader.js";

return loadPrompt("notice.pending_task", { active, phase: st.phase });
```

## API (`src/prompts/loader.js`)

| Export | Purpose |
|--------|---------|
| `loadPrompt(id, vars?, opts?)` | Load + interpolate one prompt. Throws on unknown id / missing var / unreadable file. `opts.root` overrides the prompts dir (used by tests). |
| `listPrompts(opts?)` | Return the catalog entries. |
| `parseFrontmatter(text)` | Split `{ data, body }`; exported for reuse/tests. |
| `clearCache()` | Invalidate catalog + file caches. |

Caching is process-wide; call `clearCache()` only in tests or after editing
prompts at runtime.

## Maintenance

- Add a prompt: create the `.md` under the right category, add its `id`, `path`,
  `status`, `consumers` and `testRefs` to `index.json`.
- Wire it: replace the literal with `loadPrompt("<id>", vars)` and add the call
  site to `consumers`.
- Prove equivalence: add a case to `src/prompts/characterization.test.mjs`
  pinning the exact expected string.

## Scripts

```bash
npm run prompts:check   # validate index.json + files exist + ids/paths consistent
npm run prompts:list    # print the catalog
node --test src/prompts # loader + characterization tests
```

## Invariants

- Extracting a prompt must be **byte-for-byte identical** in behavior; the
  characterization suite is the source of truth.
- No interpolation logic in prompt files beyond `{{var}}`.
- Prompt ids are stable dot-separated keys; consumers reference them by id only.
- `prompts/` is published (`package.json#files`); never move it outside the package.
