# 05. SOTA Agentic Memory & Iteration Harness

> **Track 5 Guide**: How this monorepo applies Anthropic and OpenAI harness-engineering and context-engineering practices—progressive disclosure via a nested `.agents/memory/` knowledge base, out-of-band consolidation (`dream-consolidate`), evidence discipline, real-target testing standards, and a two-way Iteration Judgment Log—without bloating a lean codebase.

---

## 1. Judgment Call: Lean Memory Scope

**Do not build a heavy knowledge base for internal code.** In a lean monorepo (`apps/*`, `packages/*`), internal source files are small and already governed by per-app `AGENTS.md` constitutions and [`pnpm verify:slice`](./04-closed-loop-verification-harness.md). Documenting *what internal code currently does* inside a memory store creates context rot and goes stale on the next refactor.

What **does** compound across sessions—and cannot be inferred from reading our source files—is **deterministic external reality and process discipline**:
1. **Environment & Toolchain Facts (`gotchas/`)**: Exact SDK flags, compiler quirks, and OS/shell constraints observed on this machine (e.g., `MacOSX26.5.sdk` + `--build-system native` + `Testing.framework` `-F` flags on CommandLineTools-only macOS).
2. **Decisions & Observed Platform Walls (`decisions/`)**: Concise `ADR-MEM-*` records capturing what was tried, what was directly observed, and what remains an open question.
3. **Process & Verification Standards (`process/`)**: Concrete rules for testing, independent review, and evidence discipline learned from past iterations.

---

## 2. Nested File-System Knowledge Base & Progressive Disclosure

Instead of a single flat file, `.agents/memory/` uses a nested directory hierarchy with an `INDEX.md` routing map at each level:

```text
AGENTS.md                          # Root map: CI gates + pointers
└── .agents/memory/
    ├── INDEX.md                   # Top-level memory map
    ├── gotchas/
    │   └── INDEX.md               # Toolchain, OS, and SDK gotchas
    ├── decisions/
    │   └── INDEX.md               # ADR-MEM-* records (facts vs. open questions)
    └── process/
        ├── INDEX.md               # Engineering & verification process
        └── testing-standards.md   # Real-target E2E & independent review rules
```

### Out-of-Band Consolidation (`dream-consolidate`)
After major work, failures, or parked experiments, run the `dream-consolidate` skill out-of-band to scan session transcripts and diffs, promote verified facts into `.agents/memory/{gotchas,decisions,process}/`, and prune ephemeral clutter so new sessions start with a clean, high-signal context window.

---

## 3. SOTA Harness & Context-Engineering Alignment

Our harness draws directly from published Anthropic and OpenAI engineering practices:

| Practice | Source & Key Idea | How We Apply It |
| :--- | :--- | :--- |
| **Long-Running Agent Harnesses** | **Anthropic**, [*Effective harnesses for long-running agents*](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents): two-part architecture (initializer + worker), structured progress artifacts, agent-maintained handoffs/git commits, default-fail verification contracts, and fresh-context evaluators. | Workers start with fresh context, commit parked or finished work rather than leaving untracked state, and hand off to an independent `@verifier` that did not author the code. |
| **Context Engineering** | **Anthropic**, [*Effective context engineering for AI agents*](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents): treat the context window as a finite attention budget prone to context rot; keep instructions at "the right altitude"; use compaction, tool-result clearing, subagent isolation, and external memory artifacts. | Root `AGENTS.md` and `INDEX.md` files stay small as routing tables; subagents isolate investigation/verification; `dream-consolidate` distills transcripts into concise topic files. |
| **Harness Engineering** | **OpenAI**, [*Harness engineering: leveraging Codex in an agent-first world*](https://openai.com/index/harness-engineering/): `Agent = Model + Harness` ("Humans steer, agents execute"); make repositories agent-legible (`AGENTS.md`), enforce automated sensors/feedback loops (tests, linters, type checks), and run entropy/garbage-collection passes for drift. | `AGENTS.md` + `docs/software-factory/` make repo invariants explicit; `pnpm verify:slice` and `scripts/check.sh` provide fast, deterministic feedback; periodic memory/doc audits remove drift. |

---

## 4. Evidence Discipline & Testing Standards

### Evidence Discipline
- **Facts and observed outputs only**: Record exact commands, file paths, timestamps, and error strings that were directly observed.
- **Never state hypotheses as causes**: If a failure's root cause was not isolated (for example, `EXP-004` losing Google Sign-In after returning to background), record the code/DB facts and list candidate explanations under **Open Questions**.
- **Commit parked work**: Never `rm -rf` untracked experiment code; commit it in a `PARKED` state so future cycles can inspect or resume without reconstructing from transcripts.

### Testing Standards Summary
Full requirements live in [`.agents/memory/process/testing-standards.md`](../../.agents/memory/process/testing-standards.md). In short:
1. **Prove the riskiest assumption first**: Test auth, OS entitlements, and state continuity before building UI or `.app` packaging.
2. **Test the real production entrypoint**: Standalone CLI commands in `/tmp` do not validate app process-management or profile-lock code.
3. **Test critical state transitions**: Any flow that switches processes or modes (e.g., interactive window → background headless) must have an automated check asserting that session/state survives.
4. **Independent review**: Code authors (including coordinators) do not self-certify fixes; an independent verifier runs the checks.

---

## 5. The Iteration Judgment Log (Not a Gate)

Rather than a pre-build feasibility gate that blocks ideas, we maintain a **two-way Iteration Judgment Log** in [`docs/experiments/iteration-log/README.md`](../experiments/iteration-log/README.md). Every cycle is evaluated from two angles:

1. **Thesis & Outcome Lens**: Did the approach get us what we wanted? What did we learn about the problem, platform, or market, and what remains an open question?
2. **Builder & Process Lens**: How fast did we iterate (wall-clock, `build → user-test` cycles, time to first real user test, time to falsify each approach), how many defects did the user catch vs. automated checks, and what must change in how we build?

Each entry closes with an **investor-style memo**—deciding whether we would back the next cycle, on what terms, and what the cheapest next proof is—so every iteration steers toward higher-leverage, more pivotal technical bets.

---

**Previous Guide**: [4. Closed-Loop Verification Harness (`pnpm verify:slice`)](./04-closed-loop-verification-harness.md)
