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

We will implement a unified **4-Gate GitHub Actions CI/CD Pipeline** (`.github/workflows/ci.yml`) and a **Multi-Ecosystem Dependabot Configuration** (`.github/dependabot.yml`):

1. **Gate 1 — Code Quality (`code-quality`)**:
   - Executes `pnpm run lint` and `pnpm run typecheck` across the Turborepo workspace.
   - Verifies the plain-Markdown docs and ADR structure (`docs/README.md`, `docs/monorepo-conventions.md`, `docs/adr/`, `docs/stack-best-practices/`). TechDocs builds are not required.
   - Runs TypeScript static verification on `apps/pulse/web` (`tsc --noEmit`) and Android Lint (`./gradlew lintDebug`) on `apps/pulse`.
2. **Gate 2 — Build (`build`)**:
   - Compiles all Turborepo packages and apps (`pnpm run build`).
   - Assembles the Pulse Android Debug APK (`./gradlew assembleDebug`), compiles the Pulse Spring Boot 4 / Java 21 backend (`./gradlew classes testClasses`), and builds the Pulse Web production bundle (`npm run build`).
   - Uploads built distribution artifacts (`workspace-dist`, `pulse-debug-apk`, `pulse-web-dist`) for downstream verification and distribution.
3. **Gate 3 — Test (`test`)**:
   - Runs Turborepo workspace tests (`pnpm run test`).
   - Executes the Pulse JUnit 4 + `MockWebServer` contract suite + automated 18/18 WCAG 2.2 AA `ColorContrastAuditTest` (`./gradlew testDebugUnitTest`).
   - Executes the Pulse Spring Boot 4 JUnit 5 test suite (`./gradlew test`) and Angular 21 Vitest suite (`npm test`).
4. **Gate 4 — Deploy & Distribution (`deploy`)**:
   - Depends on `code-quality`, `build`, and `test`.
   - Downloads and verifies staged build artifacts (`app-debug.apk`, `pulse-web-dist`, `workspace-dist`) and publishes a deployment & distribution readiness summary to `$GITHUB_STEP_SUMMARY` while web service deployment and mobile distribution channels are finalized.
5. **Multi-Ecosystem Dependabot (`.github/dependabot.yml`)**:
   - Configures weekly grouped updates across `github-actions`, the root `pnpm` workspace (resolved from `/` only, which covers `apps/web` and `packages/*` without duplicate PRs), `apps/pulse` Gradle version catalogs, `apps/pulse/backend` Gradle dependencies, `apps/pulse/web` npm packages, and `infra/docker-compose.yml` service images (Postgres/Redis majors ignored).
6. **Backstage is experimental and out of scope**:
   - `apps/backstage` (isolated Yarn 4 / Node 24) is excluded from CI and Dependabot until it is promoted. Its `catalog-info.yaml` / `mkdocs.yml` files are not validated; plain Markdown is the documentation standard.

---

## Rationale

- **Merge Queue Compatible**: Triggering on `merge_group` in addition to `pull_request` and `push` ensures the `promote & merge` ruleset can automatically validate and squash-merge queued PRs.
- **Explicit Separation of Concerns**: Splitting `code-quality`, `build`, `test`, and `deploy` into distinct jobs provides immediate diagnostic clarity in PR checks while running `code-quality`, `build`, and `test` in parallel for fast feedback.
- **Artifact-First Distribution Gate**: Staging build outputs as GitHub Actions artifacts allows us to plug in Firebase App Distribution, GitHub Releases, Firebase Hosting, Render, or Cloud Run in the `deploy` job without restructuring upstream build/test steps.

---

## Consequences

- Every Pull Request and Merge Queue entry is validated across Node 20 (`pnpm`), JDK 17/21 (`Gradle`), and Android SDK toolchains before landing on `main`.
- Dependabot automatically opens grouped, Conventional Commit (`chore(...)`) pull requests every Monday, which are themselves validated by the 4-gate CI pipeline.
