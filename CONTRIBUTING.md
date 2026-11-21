# Contributing & Developer Onboarding

Welcome to the **CMP monorepo**. This guide covers everything you need to go from a fresh clone to a green, merge-ready pull request.

---

## 1. Day-1 Setup & Local Prerequisites

| Tool | Required? | Purpose | Version / Notes |
| :--- | :--- | :--- | :--- |
| **Node.js + pnpm** | Required | Root workspace, packages, Angular web, docs/factory scripts | Node `20`, pnpm `9.12.3` ([`mise.toml`](./mise.toml)) |
| **JDK 21** | For JVM/KMP/Android | Spring Boot backend, KMP (`17` toolchain), Gradle builds | `temurin-21` |
| **Python 3** | Required | CI project discovery (`.github/scripts/discover_projects.py`) | Python `3.10+` |
| **Android SDK** | Android changes only | `apps/pulse` Android lint/build/tests | Set `ANDROID_HOME` (CI skips if absent locally unless `CHECK_STRICT=1`) |
| **Docker** | Optional | Local prod-parity containers (`infra/compose.prod-local.yml`) | Multi-stage build parity |
| **Google OAuth / Cloud secrets** | **Not needed locally** | Local dev, unit tests, and Playwright E2E use deterministic fake providers | See `FakeGoogleTasksStub` & `FakeGoogleOAuthProvider` |

Bootstrap your environment in one command:

```bash
./scripts/bootstrap.sh
```

This installs pinned toolchains (when `mise` is installed), verifies parity against CI (`node scripts/check-toolchain-parity.mjs`), installs root workspace dependencies (`pnpm install --frozen-lockfile`, which registers **Lefthook** `commit-msg` and `pre-push` hooks), and runs `scripts/check.sh --changed`.

---

## 2. Branching & Commit Rules

- **Trunk-based development:** Branch off `origin/main` using short-lived branches tied to Linear issues (e.g., `feat/ste-123-short-slug` or `fix/ste-123-short-slug`).
- **One ID scheme:** Reference Linear IDs (`STE-xxx`) in PR titles/descriptions and branches.
- **Conventional Commits (enforced locally & in CI):**
  `commitlint` ([`commitlint.config.mjs`](./commitlint.config.mjs)) checks both the Lefthook `commit-msg` hook and PRs in [`.github/workflows/commitlint.yml`](./.github/workflows/commitlint.yml):
  ```text
  feat(pulse-web): add rescue triage shortcut (STE-123)
  fix(api): handle empty task list response (STE-124)
  docs(onboarding): clarify local test fixtures
  ```

---

## 3. Local Verification Before Pushing

Lefthook runs Gate 1 on `git push` for changed stacks. Run the exact CI commands locally anytime:

```bash
# Run all gates for stacks touched since origin/main
./scripts/check.sh --changed

# Run a specific stack or gate (stacks: pnpm-turborepo, angular, springboot, android, kmp)
./scripts/check.sh --stack angular --gate quality
./scripts/check.sh --stack springboot

# Web E2E (Playwright against local Pulse web dev server)
cd apps/pulse/web && npm run test:e2e

# Minimum-viable docs & internal link check
pnpm docs:check
```

See [`docs/local-validation.md`](./docs/local-validation.md) for the full gate matrix.

---

## 4. OpenAPI 3.1 Contract-First Workflow (`apps/pulse`)

Whenever you change a Spring Boot DTO or endpoint in `apps/pulse/backend`:

```bash
pnpm api:sync      # Exports OpenAPI 3.1 spec + regenerates Angular TS & KMP Kotlin clients
pnpm api:check     # Verifies committed spec and generated clients are in sync
pnpm api:breaking  # Checks for breaking API changes against origin/main
```

PRs that modify backend endpoints without running `pnpm api:sync` will fail the `API Contracts · Pulse OpenAPI 3.1` CI check. See [`docs/guides/02-contract-first-apis-openapi-playbook.md`](./docs/guides/02-contract-first-apis-openapi-playbook.md).

---

## 5. Scaffolding New Libraries & Apps

Never copy-paste an existing app or config directory. Use `pnpm gen`:

```bash
pnpm gen lib my-utils                  # TypeScript library in packages/
pnpm gen app web my-portal             # Angular 21 Signals web app in apps/
pnpm gen app service my-api --infra    # Spring Boot 4 service in apps/ (+ Postgres/Redis compose.yaml)
pnpm gen app android my-mobile         # Kotlin/Compose Android app in apps/
```

Every generated project wires shared configs (`@cmp/config` or `build-logic/` `stefs.*` plugins + `gradle/libs.versions.toml`) and includes `AGENTS.md`, `README.md`, and starter tests.

---

## 6. Pull Request & CI Lifecycle

1. **Affected-Only CI:** `.github/scripts/discover_projects.py` runs Node, Angular, Spring Boot, KMP, and Android gates only for stacks impacted by your PR.
2. **PR Previews (`apps/pulse/web`):** Opening/updating a PR that touches `apps/pulse/web` deploys a zero-traffic Cloud Run preview revision and posts a sticky preview URL comment (`<!-- cmp-web-preview:pulse-web -->`).
3. **E2E & Security Gates:** Playwright critical-journey specs, CodeQL, Gitleaks, Semgrep, Trivy, OSV-Scanner, and Blast-Radius AST analysis run automatically.
4. **Squash & Merge:** PRs squash-merge into `main`; `release-please` opens component release PRs from Conventional Commits, and tagged releases (`pulse-backend-v*`, `pulse-web-v*`, `pulse-android-v*`) trigger automated deployment.
