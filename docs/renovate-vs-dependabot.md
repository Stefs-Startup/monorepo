# Self-Hosted Renovate OSS vs. Dependabot Comparison (CMP Monorepo)

This analysis compares our current [`.github/dependabot.yml`](../.github/dependabot.yml) configuration against the self-hosted open-source Renovate + OpenRewrite + Blast-Radius pipeline (`renovate/renovate.jsonc`, `renovate/config.js`, `.github/workflows/renovate-self-hosted.yml`).

All repository facts below are grounded in our checked-in manifests and CI setup (`pnpm@9.12.3` with `pnpm-lock.yaml` v9.0, Gradle `8.14.x` Kotlin DSL in `apps/pulse`, `apps/pulse/backend` Spring Boot `4.1.2` / Java 21, `apps/pulse/kmp` Kotlin `2.1.0`, `apps/pulse/web` Angular `21.2.26` / `package-lock.json` v3, `infra/docker-compose.yml`, and `.github/ci-projects.json` excluding `apps/backstage`).

---

## Feature & Architecture Matrix

| Dimension | Dependabot ([`.github/dependabot.yml`](../.github/dependabot.yml)) | Self-Hosted Renovate OSS ([`renovate/renovate.jsonc`](../renovate/renovate.jsonc)) | Impact on CMP & Org Repos |
| :--- | :--- | :--- | :--- |
| **Execution & Hosting Model** | GitHub-hosted proprietary service (`dependabot`). No local dry-run runner. | 100% open-source `renovate/renovate:full` container via [`renovate/docker-compose.yml`](../renovate/docker-compose.yml) or [`.github/workflows/renovate-self-hosted.yml`](../.github/workflows/renovate-self-hosted.yml). Zero external SaaS. | Runs identically on developer laptops, GitHub Actions, or self-hosted runners with full log visibility. |
| **Dry-Run & Side-by-Side Diffing** | None. Ruleset/grouping edits only take effect when GitHub opens live PRs. | `dryRun: "full"` default in [`renovate/config.js`](../renovate/config.js) + `--platform=local --dry-run=lookup` in Docker Compose. | Operators can capture `renovate-run.jsonl` and diff proposed PRs against `.github/dependabot.yml` before enabling live PRs (`RENOVATE_DRY_RUN=false`). |
| **Spring Boot + Jackson Grouping** | `apps/pulse/backend` groups `org.springframework.*` and `io.spring.*` under `spring-boot`, while Jackson and other libraries fall into catch-all `backend-deps`. | `spring-boot-and-jackson` groups `org.springframework.boot*`, `org.springframework.*`, `io.spring.*`, `com.fasterxml.jackson*`, and `tools.jackson*` across Gradle & Maven. | Prevents split PRs when Spring Boot 4 / Jackson 3 coordinates evolve together (`separateMajorMinor: true`). |
| **Automated Code Remediation (`OpenRewrite` & `ng update`)** | **Unsupported.** Bumps manifest versions only; code/property migrations break CI until manually fixed. | **`postUpgradeTasks` supported** with strict `allowedCommands` allowlist (`allowShellExecutorForPostUpgradeCommands: false`): runs `./gradlew --no-daemon rewriteRun`, `mvn -B -ntp rewrite:run`, and `npx --no-install ng update <pkg> --migrate-only`. | Automatically applies Spring Boot 4 / Spring Security 7 OpenRewrite recipes (`rewrite-spring:6.37.1`) and Angular schematics on the PR branch before commit. |
| **pnpm + npm + Gradle Lockfile & Catalog Handling** | Root `npm` ecosystem at `/` only (separate workspace dirs would open duplicate PRs); `apps/pulse/web` uses separate `npm` entry; no weekly lockfile refresh; no `gradle-wrapper` awareness. | Native `pnpm` workspace support across `/`, `apps/web`, `packages/*`, `tools/*`; weekly `lockFileMaintenance` for transitive hygiene; `apps/pulse/web` `package-lock.json` v3; `gradle` + `gradle-wrapper` + `libs.versions.toml` across `apps/pulse` and `apps/pulse/kmp`. | Eliminates stale transitive lockfiles in `pnpm-lock.yaml` and coordinates `gradle-wrapper.properties` with Kotlin/AGP. |
| **Major / Lockstep Guardrails** | Uses `ignore:` (silently hides `typescript` major, `org.jetbrains.kotlin*`, `com.google.devtools.ksp*`, `com.android.*`, `gradle*` major, `com.squareup.okhttp3:*` major, `@angular/*` major, `vitest` major, `postgres` major, `redis` major). | Uses `dependencyDashboardApproval: true` + `automerge: false` on lockstep/major packages (`pulse-kotlin-android-lockstep`, TypeScript 7, Angular 22, Vitest, OkHttp, Postgres, Redis). | Risky upgrades remain visible on the **Renovate Dependency Dashboard** issue for one-click opt-in instead of disappearing silently. |
| **GitHub Actions Pinning** | Groups `.github/workflows` (`github-actions`) and bumps version tags/SHAs as authored. | Uses `helpers:pinGitHubActionDigests` + `pinDigests: true` in `github-actions` rule. | Automatically preserves full commit SHA pinning (`@<sha> # vX.Y.Z`) matching [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). |
| **Experimental Exclusion (`apps/backstage`)** | Excluded implicitly because `apps/backstage` is not listed in `updates:`. | Explicitly excluded via `ignorePaths` (`"apps/backstage/**"`, `"**/apps/backstage/**"`) matching [`.github/ci-projects.json`](../.github/ci-projects.json). | Prevents accidental scanning even if `apps/backstage` is introduced on a branch. |
| **Auto-Merge & Blast-Radius Gating** | No built-in auto-merge; requires separate workflow scripts without AST/critical-path awareness. | `platformAutomerge: true` + `automerge: true` for non-major updates, enforced by GitHub branch ruleset + `Blast-Radius AST & Safety Gate` (`.github/workflows/blast-radius.yml`, `@cmp/blast-radius` `--gate`). | Auto-merge completes **only** when `--gate` exits `0` (`HIGH CONFIDENCE / AUTO-MERGE`); `MODERATE - VERIFY TESTS` (exit `10`, blocked unless `allow_moderate`) and `CRITICAL PATH TOUCHED - MANUAL REVIEW` (exit `20`) block auto-merge for human review. |
| **Cross-Org Portability (Gradle + Maven)** | `.github/dependabot.yml` is repo-path hardcoded (`/apps/pulse/backend` Gradle only). | `renovate/renovate.jsonc` handles both Gradle (`build.gradle.kts` / `libs.versions.toml`) and Maven (`pom.xml` via [`renovate/templates/maven-openrewrite-snippet.xml`](../renovate/templates/maven-openrewrite-snippet.xml)). | Same preset works across Gradle Kotlin DSL services in this monorepo and Maven Spring services in sibling org repos. |

---

## Side-by-Side Comparison with Existing `.github/dependabot.yml` Rules

Mapping each of the 6 blocks in [`.github/dependabot.yml`](../.github/dependabot.yml) to [`renovate/renovate.jsonc`](../renovate/renovate.jsonc):

1. **`github-actions` (`/`)**:
   - *Dependabot*: Weekly Monday 09:00 `America/New_York`, `open-pull-requests-limit: 5`, `chore(ci)` prefix, group `*`.
   - *Renovate*: Same Monday `before 9am on monday` (`America/New_York`), `chore(ci)` prefix, `github-actions` group, plus `pinDigests: true` and Blast-Radius-gated auto-merge on non-major updates.
2. **Root `pnpm` + Turborepo (`/` — `apps/web`, `packages/*`, `tools/*`)**:
   - *Dependabot*: Targets `/` only (`npm` ecosystem), `chore(deps)`, ignores `typescript` semver-major.
   - *Renovate*: Groups root and workspace manifests under `pnpm-workspace-deps`, enables weekly `lockFileMaintenance`, and moves `typescript` major upgrades behind `dependencyDashboardApproval: true`.
3. **Pulse Android & KMP (`/apps/pulse`, `/apps/pulse/kmp`)**:
   - *Dependabot*: Groups `androidx.*` / GMS / Firebase (`androidx-and-compose`) and `pulse-runtime-libs`, while ignoring Kotlin, KSP, AGP, Gradle major, and OkHttp major. Note that `/apps/pulse/kmp` (`apps/pulse/kmp/build.gradle.kts`) is not separately listed as a Dependabot Gradle directory.
   - *Renovate*: Covers both `apps/pulse` (`libs.versions.toml` + `app/build.gradle.kts`) and `apps/pulse/kmp/build.gradle.kts`, groups Kotlin/KSP/AGP/`kotlinx`/Gradle wrapper into `pulse-kotlin-android-lockstep` behind `dependencyDashboardApproval: true`, and gates `okhttp3` majors via Dependency Dashboard approval.
4. **Pulse Spring Boot 4 / Java 21 Backend (`/apps/pulse/backend`)**:
   - *Dependabot*: Groups `org.springframework.*` and `io.spring.*` (`spring-boot`) separately from `backend-deps` (`*`).
   - *Renovate*: Groups Spring Boot, Spring Framework, Spring Security, and Jackson into `spring-boot-and-jackson`, and executes `./gradlew --no-daemon rewriteRun` via `postUpgradeTasks` (with `org.openrewrite.rewrite` `7.39.0` + `rewrite-spring` `6.37.1` configured in [`apps/pulse/backend/build.gradle.kts`](../apps/pulse/backend/build.gradle.kts)). Note: `rewriteDryRun`/`rewriteRun` requires a Java 21 `JAVA_HOME` (matching CI) so OpenRewrite's Java parser parses Java 21 sealed-interface `switch` pattern matching (`PulseAccountabilityService.java`, `TriageRules.java`) without parse errors.
5. **Pulse Angular 21 Web (`/apps/pulse/web`)**:
   - *Dependabot*: Groups `@angular/*`, `rxjs`, `zone.js` (`angular-framework`) and ignores `@angular/*`, `typescript`, `vitest` majors.
   - *Renovate*: Preserves `angular-framework` grouping, runs `npm ci --ignore-scripts` + `npx --no-install ng update {{{depName}}} --migrate-only ...` when `@angular/core` or `@angular/cli` bumps, and gates major Angular/TypeScript/Vitest bumps behind `dependencyDashboardApproval: true`.
6. **Docker Compose (`/infra/docker-compose.yml`)**:
   - *Dependabot*: Tracks `/infra` (`docker-compose`), ignores `postgres` and `redis` majors.
   - *Renovate*: Groups `/infra` images under `docker-compose-infra` and surfaces `postgres`/`redis` majors via `dependencyDashboardApproval: true` so data migrations stay deliberate.

---

## Side-by-Side Dry-Run Verification Workflow

Before retiring [`.github/dependabot.yml`](../.github/dependabot.yml):

1. **Run Renovate in `dryRun: "full"` mode** (either locally via [`renovate/docker-compose.yml`](../renovate/docker-compose.yml) or via GitHub Actions `workflow_dispatch` on [`.github/workflows/renovate-self-hosted.yml`](../.github/workflows/renovate-self-hosted.yml) with `dry_run=full`).
2. **Compare the generated PR plan (`renovate-run.jsonl`)** against currently open Dependabot PRs: verify identical grouping, zero PRs for `apps/backstage`, and confirm held majors appear only on the Dependency Dashboard plan.
3. **Verify Blast-Radius Safety Gate compatibility**: trigger `.github/workflows/blast-radius.yml` (`Blast-Radius AST & Safety Gate`) on a test Renovate branch or run `node tools/blast-radius/dist/src/cli.js --base origin/main --head HEAD --gate` against a sample Spring Boot or Angular dependency delta to verify exit `0` / `10` / `20` behavior.
4. **Cutover**: remove overlapping `updates:` blocks from `.github/dependabot.yml` (optionally retaining GitHub Dependabot Security Alerts only), then set repository variable `RENOVATE_DRY_RUN=false` (or pass `dry_run=false` in `workflow_dispatch`).
