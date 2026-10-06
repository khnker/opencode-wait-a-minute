# Testing

## Test suites

WAM includes:
- **Unit tests**: Isolated function and class tests
- **Integration tests**: Cross-component interactions
- **End-to-end tests**: Full user workflows
- **Benchmarks**: Performance and token usage measurements

## Running tests

\`\`\`bash
# Unit and integration tests
npm test

# End-to-end tests
npm run test:e2e

# Benchmarks
npm run benchmark

# RC1 validation gate
npm run gate
\`\`\`

## Test locations

- \`tests/unit/\`: Unit tests
- \`tests/integration/\`: Integration tests
- \`tests/e2e/\`: End-to-end tests
- \`benchmarks/\`: Benchmark suites

## Writing tests

Follow the existing patterns in the codebase. Use:
- \`describe\` and \`it\` for test organization
- Expect assertions for validation
- Mocks for external dependencies

## Related documentation

- [Release](release.md)
- [Contributing](contributing.md)
