# Evidence

## What is evidence in WAM?

Evidence is verifiable information that supports a claim or requirement. WAM collects:
- **Test results**: Pass/fail status
- **Build artifacts**: Compiled binaries, packages
- **Logs**: Execution traces
- **Metrics**: Performance, token usage
- **File states**: Created/modified/deleted files

## Evidence chain

```mermaid
flowchart LR
    A[Claim] --> B[Technical explanation]
    B --> C[Implementation]
    C --> D[Test / benchmark]
    D --> E[Evidence]
```

## Related documentation

- [Requirements](requirements.md)
- [Verification](verification.md)
