# ADR-0003: Monorepo CI/CD Pipeline & Automated Dependency Governance (CMP-18)

**Status:** Accepted
**Date:** 2026-11-09
**Deciders:** Company of One

---

## Context

As the CMP monorepo expands across multiple ecosystems—including the root `pnpm` + Turborepo workspace (`apps/web`, `packages/config`, `packages/utils`), the multi-stack Pulse application (`apps/pulse` Android/Kotlin, `apps/pulse/backend` Spring Boot 4 / Java 21, and `apps/pulse/web` Angular 21)—manual local verification is no longer sufficient to guarantee branch health.

Furthermore, our repository ruleset (`promote & merge`) enforces a **GitHub Merge Queue (`ALLGREEN`)** on `main`, requiring automated status checks that support `pull_request`, `push`, and `merge_group` triggers, alongside automated dependency security and version maintenance across all ecosystems.

---

## Decision

We will implement **reusable, language-level GitHub Actions workflows** that any repository in the organization can call, a **convention-based monorepo CI** (`.github/workflows/ci.yml`) that calls them once per discovered project, and a **Multi-Ecosystem Dependabot Configuration** (`.github/dependabot.yml`):

1. **Reusable language workflows (`on: workflow_call`)** — each runs Gate 1 Code Quality → Gate 2 Build → Gate 3 Test for one project directory and uploads its build outputs:
   - [`reusable-node.yml`](../../.github/workflows/reusable-node.yml): JavaScript/TypeScript. Detects npm / pnpm / yarn from the lockfile and the Node version from `.nvmrc` / `.node-version`, then runs whichever of the `lint`, `typecheck`, `build`, `test` scripts exist. Turborepo roots work unchanged because their scripts call `turbo`.
   - [`reusable-gradle.yml`](../../.github/workflows/reusable-gradle.yml): Java, Kotlin, Spring Boot, Android. Detects Android from the build scripts; defaults are `lintDebug` / `assembleDebug` / `testDebugUnitTest` (Android) and — / `assemble testClasses` / `test` (JVM). Every task list can be overridden or skipped.
   - Other repositories call them with `uses: Stefs-Startup/monorepo/.github/workflows/reusable-<language>.yml@main`. See [CI Reusable Workflows](../ci-reusable-workflows.md).
2. **Project discovery** — [`discover_projects.py`](../../.github/scripts/discover_projects.py) lists every tracked `gradlew` (Gradle build) and every `package.json` with its own lockfile (Node project, including the root pnpm workspace), minus the `exclude` list in [`.github/ci-projects.json`](../../.github/ci-projects.json). Adding an app needs no workflow change; `overrides` exist for projects that cannot follow the defaults.
   - Current result: `.` (pnpm + Turborepo: `apps/web`, `packages/*`), `apps/pulse` (Android), `apps/pulse/backend` (Spring Boot 4 / Java 21), `apps/pulse/web` (Angular 21, npm).
3. **Docs check** — verifies the plain-Markdown docs and ADR structure (`docs/README.md`, `docs/monorepo-conventions.md`, `docs/adr/`, `docs/stack-best-practices/`). TechDocs builds are not required.
4. **Gate 4 — Deploy & Distribution (`deploy`)** — the single required status check. It fails if any discovered project failed or was cancelled, then summarises the staged artifacts in `$GITHUB_STEP_SUMMARY` while distribution channels are finalised.
5. **Multi-Ecosystem Dependabot (`.github/dependabot.yml`)**:
   - Configures weekly grouped updates across `github-actions`, the root `pnpm` workspace (resolved from `/` only, which covers `apps/web` and `packages/*` without duplicate PRs), `apps/pulse` Gradle version catalogs, `apps/pulse/backend` Gradle dependencies, `apps/pulse/web` npm packages, and `infra/docker-compose.yml` service images (Postgres/Redis majors ignored).
6. **Backstage is experimental and out of scope**:
   - `apps/backstage` (isolated Yarn 4 / Node 24) is excluded from CI and Dependabot until it is promoted. Its `catalog-info.yaml` / `mkdocs.yml` files are not validated; plain Markdown is the documentation standard.

---

## Rationale

- **Merge Queue Compatible**: Triggering on `merge_group` in addition to `pull_request` and `push` ensures the `promote & merge` ruleset can automatically validate and squash-merge queued PRs.
- **Reusable across the organization**: Language workflows are written once and called by every repository, so new projects inherit the same gates without copying YAML.
- **Zero-touch onboarding**: Convention-based discovery means a new app is built and tested on its first PR; one job per project runs in parallel and names the failing project directly in PR checks.
- **Stable required check**: Matrix job names change as projects are added, so branch protection only requires `Deploy & Distribution`.
- **Artifact-First Distribution Gate**: Staging build outputs as GitHub Actions artifacts allows us to plug in Firebase App Distribution, GitHub Releases, Firebase Hosting, Render, or Cloud Run in the `deploy` job without restructuring upstream build/test steps.

---

## Consequences

- Every Pull Request and Merge Queue entry is validated across Node (`pnpm`/`npm`/`yarn`), JDK 21 (`Gradle`), and Android SDK toolchains before landing on `main`.
- The `promote & merge` ruleset should require only the `Deploy & Distribution` check.
- For other repositories to call the reusable workflows while this repository is private, enable *Settings → Actions → General → Access → Accessible from repositories in the organization*.
- Dependabot automatically opens grouped, Conventional Commit (`chore(...)`) pull requests every Monday, which are themselves validated by the same CI pipeline.
