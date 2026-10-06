# Wait a Minute

Cognitive pre-flight and execution-control for OpenCode agents.

Wait a Minute (WAM) helps agents understand before they act, reducing unnecessary work and improving task completion quality.

## What do I gain from using WAM?

- **Less guessing**: Agent decisions are verified instead of silently invented
- **Less lost work**: Verified progress prevents rework
- **Fewer unsupported "Done" claims**: Completion requires evidence
- **Less unnecessary context**: Only relevant context is loaded

## What changes after installing WAM?

- WAM runs as a prompt hook before skill resolution
- Task classification becomes explicit
- Skill selection is evidence-based
- Completion requires verification

## Installation

\`\`\`bash
# Install via npm
npm install wait-a-minute-plugin
\`\`\`

## Evidence

See [docs/claims/] for detailed explanations of each claim with implementation, test, and evidence references.

## How WAM works

See [docs/architecture/] for architectural overview and technical details.

## Configuration

See [docs/development/] for development and configuration guides.

## Commands

See [package.json] for available npm scripts.

## Limitations

See [docs/claims/] for limitations of each claim.

## Development

See [docs/development/] for contributing guide and development practices.
