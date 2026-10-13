# Proposal: Enforce Prompt Catalog Integrity
Make `prompts/index.json` a verifiable contract: the catalog, the prompt files, their interpolation variables, their declared consumers and test references, and their actual `loadPrompt("<id>")` usage in source MUST all agree, or the integrity check fails the build.
## Goals
1. Detect catalog drift: duplicate ids, missing files, path escapes, and unregistered prompt files.
2. Bind every `{{var}}` placeholder in a prompt body to a declared `inputs` entry, and every declared input to an actual usage.
3. Verify every `consumers[]` and `testRefs[]` reference resolves to an existing file (and that a `#symbol`, when present, exists in that file).
4. Detect orphan prompts (registered but never referenced) and unregistered usage of `loadPrompt("<id>")`.
5. Wire the check into `npm run prompts:check` and the RC1 release gate so any drift blocks the release.
