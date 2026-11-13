# Company of One — Monorepo

> One person. One repo. All the things.

This is the root of the **CMP monorepo** — the single source of truth for all
apps, shared packages, infrastructure, and documentation in this Company of One.

---

## Repository Map

```
/
├── apps/                  Deployable units & reference applications
│   ├── web/               Product showcase web app (@cmp/web)
│   └── pulse/             Polyglot reference architecture (Kotlin/KMP, Spring Boot 4, Angular 21; Gradle/npm)
├── packages/              Shared libraries & tooling consumed across apps
│   ├── factory/           Agentic Software Factory CLI & generators (@cmp/factory)
│   ├── utils/             Shared functional primitives: WCAG 2.2 AA, Zero-PII, scarcity (@cmp/utils)
│   └── config/            Shared TypeScript/build configurations (@cmp/config)
├── tools/                 Internal developer & CI tooling (pnpm workspace)
│   ├── blast-radius/      Deterministic dependency blast-radius & AST CLI (@cmp/blast-radius)
│   └── blast-radius-ui/   Local interactive Blast-Radius graph viewer (@cmp/blast-radius-ui)
├── renovate/              Self-hosted Renovate OSS config & OpenRewrite migration setup
├── infra/                 Infrastructure as code — Docker, Compose, IaC (CMP-12)
└── docs/                  Human + agent documentation
    ├── adr/               Architecture Decision Records (CMP-13)
    ├── stack-best-practices/  Multi-stack best practices (Kotlin, KMP, Compose, Firebase, Spring Boot 4, Angular 21)
    └── knowledge-base/    Enterprise knowledge base (Spring, Angular, Node, React, Web)
```

---

## Agentic Software Factory Workflow

This monorepo operates as an **Agentic Software Factory**, pairing `@cmp/factory` generators and verification gates with `@cmp/utils` pure functional primitives and `apps/pulse` as the canonical reference architecture:

```bash
# Scaffold a new app (with AGENTS.md constitution, domain engine, and tests)
pnpm gen:app <name> [--stack=web-ts|angular-spring|kmp]

# Scaffold a vertical product slice inside an existing app
pnpm gen:slice <app> <slice>

# Run the deterministic verification loop (AGENTS.md audit, WCAG 2.2 AA, Zero-PII, typecheck, tests)
pnpm verify:slice [--target=<pkg>] [--json]
```

- **`@cmp/factory` (`packages/factory`)**: Provides `gen:app`, `gen:slice`, and `verify` (`pnpm verify:slice`) to scaffold apps/slices and enforce architectural guardrails.
- **`@cmp/utils` (`packages/utils`)**: Provides pure functional primitives shared across TypeScript apps — WCAG 2.2 AA contrast auditing, Zero-PII telemetry scrubbing & pseudonymization, and focus/scarcity guards.
- **`apps/pulse` (Reference Architecture)**: Demonstrates Pure Functional Core (`ADR-007`), KMP/Compose Multiplatform (`ADR-008`), Modern Desktop Web UX (`ADR-009`), and Zero-PII observability across Kotlin, Spring Boot 4 / Java 21, and Angular 21. Managed via Gradle/npm and excluded from `pnpm-workspace.yaml`.

---

## Getting Started

**Prerequisites:** Node 20 LTS · pnpm 9+

```bash
# Install the correct Node version (if using nvm or fnm)
nvm use        # reads .nvmrc → Node 20

# Install pnpm if you don't have it
corepack enable

# Install all workspace dependencies from the repo root
pnpm install

# Run all dev servers in parallel
pnpm dev

# Run all tests
pnpm test

# Run all linters
pnpm lint

# Type-check everything
pnpm typecheck
```

---

## Workspace Commands

pnpm workspaces let you run commands scoped to one package or all packages:

```bash
# Run a command in a specific workspace
pnpm --filter <package-name> <command>

# Example: run dev only for the web app
pnpm --filter web dev

# Run a command recursively across ALL workspaces
pnpm -r build

# Add a dependency to a specific workspace
pnpm --filter web add react

# Add a shared package as a workspace dependency
pnpm --filter web add @cmp/ui --workspace
```

---

## Adding a New App or Package

Use the Agentic Software Factory CLI (`@cmp/factory`) for new apps and slices, or add a package manually:

1. Run `pnpm gen:app <name>` (or create a directory under `apps/` or `packages/` with a `@cmp/` `package.json`)
2. Use `pnpm gen:slice <app> <slice>` to add vertical slices backed by `@cmp/utils` primitives
3. Run `pnpm install` from the repo root if adding packages manually
4. Run `pnpm verify:slice` to confirm `AGENTS.md`, WCAG 2.2 AA, Zero-PII, typecheck, and test gates pass
5. See `docs/monorepo-conventions.md` for naming and structure conventions

---

## Dependency Governance & Blast-Radius Analysis

Dependency upgrades combine **self-hosted Renovate OSS** (with automated OpenRewrite / `ng update` migrations) and **deterministic AST blast-radius gating**:

- **Renovate OSS (`renovate/`)**: Side-by-side self-hosted config defaulting to `dryRun: "full"` ([`renovate/README.md`](./renovate/README.md), [`docs/renovate-vs-dependabot.md`](./docs/renovate-vs-dependabot.md), [`.github/workflows/renovate-self-hosted.yml`](./.github/workflows/renovate-self-hosted.yml)) alongside [`.github/dependabot.yml`](./.github/dependabot.yml).
- **Blast-Radius CLI (`@cmp/blast-radius`)**: Computes dependency deltas across Gradle, Maven, npm, pnpm, and optional SBOMs, then maps affected Java (`java-parser`) and Angular/TypeScript (`ts-morph`) critical-path symbols:
  ```bash
  pnpm blast-radius -- --base main --out blast-radius-report.json --md-out blast-radius-report.md
  pnpm blast-radius -- --base main --gate   # 0=AUTO-MERGE, 10=MODERATE, 20=CRITICAL PATH
  ```
- **Local Graph Viewer (`@cmp/blast-radius-ui`)**: Visualizes `blast-radius-report.json` locally using React Flow with zero external SaaS calls:
  ```bash
  pnpm blast-ui -- --report blast-radius-report.json
  ```
- **CI PR Integration**: [`.github/workflows/blast-radius.yml`](./.github/workflows/blast-radius.yml) uploads `blast-radius-report.json`, posts/updates a sticky PR comment (`<!-- cmp-blast-radius-report -->`), and blocks auto-merge when `--gate` exits non-zero.

---

## Documentation

- [`docs/`](./docs/) — Architecture docs, conventions, runbooks
- [`docs/adr/`](./docs/adr/) — Architecture Decision Records
- [`docs/monorepo-conventions.md`](./docs/monorepo-conventions.md) — Naming, structure, patterns

