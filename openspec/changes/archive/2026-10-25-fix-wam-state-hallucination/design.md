# Design: WAM State Guard

## Mechanism
- Intercept completion intent parsing in `orchestration.js` to require that at least one task or file modification has occurred in the active task session before allowing completion or test execution shortcuts.
