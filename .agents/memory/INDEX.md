# Agent Memory Index

> **Scope Rule (Lean Monorepo Principle):** This repository is lean, with small packages and per-app `AGENTS.md` files. `.agents/memory/` **must never duplicate internal code structure** that an agent can read directly in under a second. It stores only **verified external facts** (OS/SDK/toolchain/platform observations), **architectural decisions** (`ADR-MEM-*`), and **permanent process rules**.

---

## Directory Map (Progressive Disclosure: Root -> Folder -> Leaf)

| Folder / File | Purpose |
| :--- | :--- |
| [`gotchas/INDEX.md`](./gotchas/INDEX.md) | Verified OS, toolchain, shell, browser, and windowing constraints (facts + `Evidence:` only; no unverified hypotheses). |
| [`decisions/INDEX.md`](./decisions/INDEX.md) | Architectural and experiment lifecycle decisions (`ADR-MEM-NNN-*`). |
| [`process/INDEX.md`](./process/INDEX.md) | Permanent harness rules for evidence, testing, swarm workflow, and destructive/git operations. |
| [`scratchpad.md`](./scratchpad.md) | Ephemeral working notes for active sessions; reset on consolidation. |

---

## How to File New Knowledge (`dream-consolidate` Mapping)

The global `dream-consolidate` skill references the legacy flat filenames (`tool-gotchas.md`, `architecture-decisions.md`). In this repository, file entries into the nested layout instead:

- **Tool / OS / platform gotchas** -> `gotchas/<topic>.md` (update `gotchas/INDEX.md`). Facts only, with an `Evidence:` line. Never record unverified hypotheses.
- **Architectural / experiment decisions** -> `decisions/ADR-MEM-NNN-<slug>.md` (update `decisions/INDEX.md`).
- **Process / testing / workflow lessons** -> `process/<topic>.md` (update `process/INDEX.md`).
- **Per-cycle iteration judgments** -> [`docs/experiments/iteration-log/`](../../docs/experiments/iteration-log/README.md) (not `.agents/memory/`).

---

## Related Harness & Experiment References

- **Iteration Harness Architecture**: [docs/software-factory/05-sota-agentic-memory-and-iteration-harness.md](../../docs/software-factory/05-sota-agentic-memory-and-iteration-harness.md)
- **Iteration Judgment Log**: [docs/experiments/iteration-log/README.md](../../docs/experiments/iteration-log/README.md)
- **Experiments Index**: [docs/experiments/README.md](../../docs/experiments/README.md)
- **Root Agent Guidelines**: [AGENTS.md](../../AGENTS.md)
