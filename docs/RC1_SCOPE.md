# RC1 Scope Freeze Specification

This document defines the strict functional boundaries and change envelope for **Wait-a-Minute (WAM) Release Candidate 1 (RC1)**. No new capabilities, cognitive features, or architectural expansions are permitted past this boundary.

## IN SCOPE (RC1 Release Envelope)

1. **Core Pre-flight & Classification**
   - Prompt interception and risk/impact assessment.
   - Classification rules (Global, Project, Task, Requirement, Action, Session, Turn).
2. **Task Lifecycle & State Management**
   - States: `PROPOSED` → `IMPLEMENTING` → `VERIFYING` → `DONE`.
   - Persistence and recovery in `.wam/`.
   - Task isolation across sessions and projects.
3. **Assumptions & Completion Contracts**
   - Assumption gate and active tracking.
   - Blocking questions and evidence-based progress.
4. **Context Assembly & Economy (N0–N3)**
   - Minimal context packs (N0 mandatory, N1 scoped, N2 dynamic, N3 fallback).
   - Fast-path execution for continuations.
5. **Skill Registry & Routing**
   - Bundled skill registry (`skills/registry.json`) and semantic search.
6. **Verification, Packaging & Distribution**
   - Clean tarball packing (`npm pack`), unpack/install smoke tests, and security audits (`npm audit`).
7. **OpenCode Integration**
   - Compatibility contracts (`docs/OPENCODE_COMPATIBILITY.md`) and E2E runtime hooks.
8. **Benchmarks & Evidence**
   - Deterministic simulation benchmarks, real-provider execution harnesses, token economy metrics, and artifact manifest generation.

---

## OUT OF SCOPE (Explicitly Banned for RC1)

- New cognitive capabilities, agents, or memory layers.
- Higher context layers (N4, N5) or vector embeddings/RAG.
- Alternative skill or model routers.
- Major refactoring of `index.js` or core runtime hooks.
- Experimental task execution strategies not defined in the specification.
