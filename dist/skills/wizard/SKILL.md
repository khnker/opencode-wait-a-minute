---
name: wizard
description: Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infrastructure, setting up credentials or CI secrets, walking an unfamiliar third-party dashboard, or running a one-off migration or cutover. Don't invoke this for steps the agent can perform itself.
---

# Wizard

A **wizard** is a bash script that walks a human through a manual procedure: it opens each URL, states exactly what to click and copy, captures the values, writes them where they belong (`.env`, GitHub secrets), and confirms before each irreversible action.

[template.sh](template.sh) supplies the UX — stage progress, confirmation gates, cross-platform URL opening, hidden secret entry, idempotent `.env` upserts, `gh secret`/`gh variable` writes, and a closing summary. **Scope the procedure and author its stages; never hand-edit the library above the `STAGES` marker.**

Wizards are ephemeral: save to a scratch or `scripts/` path and delete when the job is done. Commit only when the user wants a repeatable setup path that lives in the repo.

## Process

### 1. Scope the procedure

Find every manual step and every value captured along the way. Read the repo first, don't ask cold:

- Setup: `.env*`, `README`, `docker-compose*`, framework config, and `.github/workflows/*` (every `secrets.*` / `vars.*` reference is a value the wizard must produce).
- Migration or transition: the current state, the target state, and the irreversible actions between them.

Show the ordered stages and the values each produces; confirm additions, drops, and reorderings.

**Done when:** stages are named in order, and for each value you know where the human gets it, where it is written (`.env`, a GitHub secret, both, or nowhere), and whether it is secret (hidden entry) or public.

### 2. Map each stage's journey

Write the precise path a human follows: URL to open, action to take, where the value appears, which variable it fills (e.g. "Dashboard → Developers → API keys → Reveal test key → copy"). Never invent UI or commands; ask the user or check the docs.

**Done when:** every stage traces to concrete instructions a stranger could follow.

### 3. Author the wizard

Copy `template.sh` to the target path. Replace the example stage with one `stage` per step, in dependency order. Use the helpers `stage`, `say`/`step`, `open_url`, `ask`/`ask_secret`, `write_env`, `set_secret`/`set_var`, `pause`/`confirm`; set `TOTAL_STAGES` to the number of stages.

Hold the template's bar: open the URL before asking for its value, use `ask_secret` for anything secret, `write_env` every persisted value, `set_secret` only values CI actually needs, and `confirm` before any irreversible action. Keep each stage to one focused task so the current step stays visible.

### 4. Verify and hand off

- `bash -n <script>`; run `shellcheck` if available.
- `chmod +x <script>`.
- Trace statically rather than running end-to-end (it opens browsers and blocks on human input): every value from step 1 is captured and lands where step 1 said, and every `set_secret` name exactly matches a `secrets.*` reference in CI.
- Tell the user how to run it. For a repeatable setup path, commit it and link it from the README so the next person runs the script instead of asking an AI.
