---
id: nudge.discovery.workdir
name: Discovery nudge: workdir
purpose: Suggest workdir param instead of cd-prefix in bash.
responsibility: Owns the nudge recommending the workdir parameter over cd-prefixed bash.
consumer: src/policy/discovery-classifier.js#workdirSuggestion
inputs: [dir]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Consider using the 'workdir' parameter ('workdir: "{{dir}}"') instead of 'cd {{dir}} && ...' in bash.
