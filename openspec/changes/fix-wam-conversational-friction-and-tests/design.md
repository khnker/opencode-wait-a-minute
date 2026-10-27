# Design: Conversational Friction Fix & WAM Integration Tests

## Architecture
- **Flexible State Machine**: Allows soft transitions on implicit user approvals when frustration or direct execution intent is detected.
- **Integration Test Harness**: Adds end-to-end simulation tests (`benchmarks/real/wam-conversational-friction.test.mjs`) verifying WAM behavior under live conversation flows.
