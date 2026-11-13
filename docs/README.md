# Documentation

This directory is the home for all human-readable and agent-readable documentation
about this monorepo — its architecture, conventions, processes, and decisions.

---

## Contents

| File / Directory | Purpose |
|-----------------|---------|
| [`adr/`](./adr/) | Architecture Decision Records — immutable log of *why* decisions were made |
| [`monorepo-conventions.md`](./monorepo-conventions.md) | Naming rules, structure patterns, and coding conventions for this repo |
| [`software-factory/`](./software-factory/README.md) | **Agentic Software Factory Curriculum (`01`–`05`)**: [01. Agentic Workspaces](./software-factory/01-from-portals-to-agentic-workspaces.md), [02. Shared Guardrail Primitives](./software-factory/02-shared-guardrail-primitives.md), [03. Deterministic Generators](./software-factory/03-deterministic-app-and-slice-generators.md), [04. Closed-Loop Verification](./software-factory/04-closed-loop-verification-harness.md), [05. Agentic Memory & Iteration Harness](./software-factory/05-sota-agentic-memory-and-iteration-harness.md) |
| [`ci-reusable-workflows.md`](./ci-reusable-workflows.md) | Org-wide reusable CI workflows (Node, Gradle) and how monorepo projects are auto-discovered |
| [`stack-best-practices/`](./stack-best-practices/README.md) | Framework-by-framework learning guides & best practices (Kotlin 2.1, KMP, Compose Multiplatform + Modern Desktop Web UX, Firebase Zero-PII Observability, Spring Boot 4 + Java 21, and Angular 21 Signals) with real examples from our apps |
| [`knowledge-base/`](./knowledge-base/README.md) | Enterprise Architecture & Full-Stack Knowledge Base (Web, Spring Boot, Node.js, Angular, React) |
| [`angular-best-practices/`](./angular-best-practices/docs/index.md) | Enterprise Angular & Java/Spring Boot documentation |

---

## Philosophy

Documentation here serves two audiences:

1. **The human maintainer** — you, at 23:45, six months from now, wondering why something was built a certain way
2. **AI agents** — agents reading this repo need structured context to make correct decisions without asking clarifying questions

For that reason, docs should be:
- **Precise**: Specific file paths, exact command syntax, concrete examples
- **Contextual**: Explain *why*, not just *what* — agents can infer what from the code
- **Durable**: Written to be useful after the surrounding context is forgotten

---

## Architecture Decision Records (ADRs)

ADRs live in [`adr/`](./adr/). Each ADR is a short document recording:
- The **context** (what was the situation)
- The **decision** (what was chosen)
- The **rationale** (why — the alternatives considered and rejected)
- The **consequences** (trade-offs accepted)

ADRs are **append-only** — never edit a past ADR. If a decision is reversed, write a new ADR that supersedes the old one. This preserves the full history of reasoning.

See [`adr/0000-adr-process.md`](./adr/0000-adr-process.md) for the ADR format and process.

---

## For Agents

Before making structural changes to this repository, check:

1. Is there a relevant ADR? If yes, understand the rationale before deviating.
2. Is the change consistent with `monorepo-conventions.md`?
3. If you're making a decision that future agents should understand, write an ADR.
