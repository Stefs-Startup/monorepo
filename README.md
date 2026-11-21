# Company of One — Monorepo

> One person. One repo. All the things.

This is the root of the **CMP monorepo** — the single source of truth for all
apps, shared packages, build logic, infrastructure, and documentation.

**New to the repo?** Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md) for your Day-1 setup and first-PR workflow.

---

## Repository Map

```
/
├── apps/                  Deployable applications
│   ├── web/               Product showcase web app (@cmp/web)
│   └── pulse/             Polyglot reference app (Android Compose, KMP, Spring Boot 4, Angular 21)
├── build-logic/           Shared Gradle convention plugins (stefs.android-app, stefs.jvm-service, stefs.kotlin-lib)
├── gradle/                Unified Gradle version catalog (libs.versions.toml)
├── packages/              Shared workspace libraries
│   ├── config/            Shared TypeScript, ESLint, and Prettier presets (@cmp/config)
│   ├── factory/           Agentic Software Factory CLI, codemod loop, scorecard (@cmp/factory)
│   ├── flags/             Feature flags & experimentation engine (@cmp/flags)
│   ├── google-auth/       Reusable Google OAuth + Tasks client & fakes (@cmp/google-auth)
│   ├── observability/     Zero-PII OTel logging, RED metrics, W3C traceparent, SLOs (@cmp/observability)
│   └── utils/             Pure functional primitives: WCAG 2.2 AA, Zero-PII, focus/scarcity (@cmp/utils)
├── turbo/generators/      pnpm gen templates (lib, app web, app service, app android)
├── tools/                 Internal developer & CI tooling
│   ├── blast-radius/      Deterministic dependency blast-radius & AST CLI (@cmp/blast-radius)
│   └── blast-radius-ui/   Local interactive Blast-Radius graph viewer (@cmp/blast-radius-ui)
├── infra/                 Dockerfiles, local prod-parity Compose, Cloud Run deploy manifest
├── renovate/              Self-hosted Renovate OSS config & OpenRewrite migration setup
└── docs/                  Human + agent documentation (ADRs, RFCs, playbooks, references)
```

---

## Getting Started (Day-1 Setup)

**Pinned toolchains** ([`mise.toml`](./mise.toml)): **Node 20**, **pnpm 9.12.3**, **JDK 21** (KMP toolchain: 17), and **Python 3** (plus optional Android SDK `ANDROID_HOME` for Android builds).

```bash
# Recommended: install pinned toolchains (if using mise), install workspace deps,
# verify toolchain parity, and run changed-stack CI gates:
./scripts/bootstrap.sh

# Or inspect your environment without modifying anything:
./scripts/bootstrap.sh --check-only
```

If you prefer managing runtimes manually (`nvm use`, `corepack enable`, JDK 21):

```bash
pnpm install --frozen-lockfile   # also installs Lefthook git hooks (commit-msg, pre-push)
./scripts/check.sh --changed     # run CI-parity gates for stacks you touched
```

---

## Running `apps/pulse` Locally

Local development and test suites use deterministic seed fixtures and fake Google Tasks/OAuth providers (`FakeGoogleTasksStub`, `FakeGoogleOAuthProvider`) — **zero real Google credentials are required**.

- **Backend (Spring Boot 4 / Java 21):**
  ```bash
  cd apps/pulse/backend && ./gradlew bootRun
  ```
- **Web (Angular 21 + Signals):**
  ```bash
  cd apps/pulse/web && npm ci && npm start
  ```
- **Full-Stack Production-Parity Containers (`pulse-backend` + `pulse-web`):**
  ```bash
  docker compose -f infra/compose.prod-local.yml up --build
  ```

---

## Scaffolding & Common Commands

### Code Generators (`pnpm gen`)

```bash
# TypeScript library in packages/ (extends @cmp/config, includes AGENTS.md, README.md, tests)
pnpm gen lib <name>

# Full-stack app templates
pnpm gen app web <name>                 # Angular 21 Signals + Vitest + @cmp/config + auth slot
pnpm gen app service <name> [--infra]   # Spring Boot 4 + stefs.jvm-service + springdoc + optional compose.yaml
pnpm gen app android <name>             # Kotlin/Compose + stefs.android-app + edge-to-edge
```

### Validation, Contracts & Docs

```bash
pnpm check                 # Run CI-parity gates for changed stacks (scripts/check.sh --changed)
pnpm check:all             # Run all stack gates across the entire monorepo
pnpm lint | typecheck | build | test   # Run Turborepo tasks across pnpm workspace packages
pnpm api:sync              # Export Spring Boot OpenAPI 3.1 spec + regenerate TS/KMP clients
pnpm api:check             # Fail if OpenAPI spec or generated clients drifted
pnpm docs:check            # Verify generated workflow/project tables and docs/ links
pnpm scorecard             # Print live repository health & release-readiness scorecard
```

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

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Day-1 setup, branching/commit rules, local verification, and PR lifecycle
- [`docs/README.md`](./docs/README.md) — Documentation map (start-here essentials, ADRs, playbooks, references)
- [`docs/local-validation.md`](./docs/local-validation.md) — Local CI-parity gate reference (`scripts/check.sh`)
- [`docs/monorepo-conventions.md`](./docs/monorepo-conventions.md) — Naming, structure, and coding conventions
