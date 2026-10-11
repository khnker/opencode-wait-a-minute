# Design: Coupling Tracer Integration

## Strategy
- **Intent Detection**: Use a conservative regex on the prompt text to detect requests involving coupling, cross-layer, or endpoint traces along with path markers.
- **Trace Execution**: Wrap `traceCrossLayer` in a try/catch block to ensure it never throws and always returns a best-effort `ok: true/false` result.
- **Injection**: Inject the compact string results into the context stack (similar to standard context packs).

## Components
- `src/context/coupling.js`: Logic module.
- `src/integration/message-handler.js`: Runtime wiring seam.
