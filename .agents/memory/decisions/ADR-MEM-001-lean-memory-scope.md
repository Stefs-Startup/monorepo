# ADR-MEM-001: Lean Agent Memory Scope & Nested Progressive Disclosure

- **Status**: Accepted (2026-11-13)
- **Context**: Duplicating explanations of internal TypeScript/Kotlin/Swift files inside `.agents/memory/` causes context bloat and stale summaries when the small source files can be read directly.
- **Decision**:
  - Restrict `.agents/memory/` to verified external facts (`gotchas/`), architectural/experiment decisions (`decisions/`), and permanent harness rules (`process/`).
  - Organize `.agents/memory/` as nested folders with per-folder `INDEX.md` files (progressive disclosure: root `INDEX.md` -> folder `INDEX.md` -> leaf file).
  - Keep internal code conventions in per-app `AGENTS.md` files and executable verification scripts.
- **Consequences**: Memory stays concise, factual, and high-signal across sessions without duplicating codebase structure.
- **Evidence**: User directive on lean codebase knowledge scope (coordinator transcript step [200], 2026-11-13) and restructure brief (board post #37, 2026-11-13).
