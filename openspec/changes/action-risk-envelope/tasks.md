# Tasks: Action Risk Envelope [Edited: implemented and verified]

- [x] 1. Define risk classification categories in `risk-engine.js`.
- [x] 2. Map existing WAM tools to SAFE/GUARDED/BLOCKED.
- [x] 3. Implement action evaluation logic (`evaluateAction`).
- [x] 4. Integrate risk check into tool interception (`index.js`).
- [x] 5. Implement escalation/block logic when action is BLOCKED.
- [x] 6. Add regression tests for:
    - [x] SAFE action allowed autonomously.
    - [x] GUARDED action within scope allowed.
    - [x] GUARDED action outside scope blocked.
    - [x] BLOCKED action rejected.
- [x] 7. Verify with existing test suite.
