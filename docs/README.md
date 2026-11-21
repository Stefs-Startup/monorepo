# Documentation

This directory is the home for all human-readable and agent-readable documentation
about this monorepo — its architecture, conventions, processes, and decisions.

---

## Start Here (Human Onboarding)

If you are new to the repository, read these first in order:

1. [**Root README**](../README.md) — Repo map, `mise.toml` / `scripts/bootstrap.sh` setup, running Pulse locally, and `pnpm gen`.
2. [**Contributing Guide**](../CONTRIBUTING.md) — Day-1 tool checklist, `STE-x` branching, Conventional Commits, OpenAPI sync, and PR CI lifecycle.
3. [**Local Validation Reference**](./local-validation.md) — Running `./scripts/check.sh --changed` and per-stack CI gates locally.
4. [**Monorepo Conventions**](./monorepo-conventions.md) — Naming rules, shared `@cmp/config` presets, and workspace patterns.
5. [**Reusable CI Workflows**](./ci-reusable-workflows.md) — Auto-generated workflow input tables, discovered projects, and `v1` tag usage.

---

## Contents

| File / Directory | Purpose |
|-----------------|---------|
| [`local-validation.md`](./local-validation.md) | Local CI-parity gate reference (`scripts/check.sh` across all stacks) |
| [`scorecard.md`](./scorecard.md) | Live repository health & release-readiness scorecard (`pnpm scorecard`) |
| [`guides/01-single-command-prod-deploy-and-rollback-playbook.md`](./guides/01-single-command-prod-deploy-and-rollback-playbook.md) | Cloud Run single-command deploy, canary smoke gate, PR previews, and instant rollback (`ADR-0004`) |
| [`guides/02-contract-first-apis-openapi-playbook.md`](./guides/02-contract-first-apis-openapi-playbook.md) | OpenAPI 3.1 contract-first APIs across Spring Boot 4, Angular 21, KMP, and `oasdiff` CI gates (`ADR-0005`) |
| [`guides/03-agent-delivery-guardrails-playbook.md`](./guides/03-agent-delivery-guardrails-playbook.md) | Agent PR guardrails, dedupe, stale sweeps, and coding-agent rules |
| [`adr/`](./adr/) | Architecture Decision Records — immutable log of *why* decisions were made |
| [`rfcs/`](./rfcs/README.md) | Exploratory RFCs — technical ideas, trade-offs, and revisit triggers before committing to code |
| [`monorepo-conventions.md`](./monorepo-conventions.md) | Naming rules, structure patterns, and coding conventions for this repo |
| [`ci-reusable-workflows.md`](./ci-reusable-workflows.md) | Org-wide reusable CI workflows (Node, Gradle, Web Preview) and auto-discovered projects |
| [`software-factory/`](./software-factory/README.md) | **Agentic Software Factory Curriculum (`01`–`06`)**: [01. Agentic Workspaces](./software-factory/01-from-portals-to-agentic-workspaces.md), [02. Shared Guardrail Primitives](./software-factory/02-shared-guardrail-primitives.md), [03. Deterministic Generators](./software-factory/03-deterministic-app-and-slice-generators.md), [04. Closed-Loop Verification](./software-factory/04-closed-loop-verification-harness.md), [05. Agentic Memory & Iteration Harness](./software-factory/05-sota-agentic-memory-and-iteration-harness.md), [06. SOTA Quality Engineering & Planning Critic](./software-factory/06-sota-quality-engineering-and-planning-critic.md) |
| [`stack-best-practices/`](./stack-best-practices/README.md) | Optional deep-dive learning guides (Kotlin 2.1, KMP, Compose Multiplatform, Firebase Zero-PII, Spring Boot 4, Angular 21 Signals) |
| [`knowledge-base/`](./knowledge-base/README.md) | Optional enterprise architecture & framework reference library |
| [`angular-best-practices/`](./angular-best-practices/docs/index.md) | Optional Angular & Java/Spring Boot reference docs |

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
