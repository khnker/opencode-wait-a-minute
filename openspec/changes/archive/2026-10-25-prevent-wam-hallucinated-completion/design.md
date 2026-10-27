# Design: Hallucination Guard

## Mechanism
- Check `hasCodeChanges()` or tracking markers before allowing `isCompletionIntent()` to evaluate as true.
