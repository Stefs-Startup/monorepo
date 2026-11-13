# Self-Hosted Renovate OSS & OpenRewrite Auto-Remediation

This directory contains the 100% open-source, self-hosted Renovate configuration for the CMP monorepo and reusable cross-organization templates. There are **zero proprietary SaaS dependencies** (no Mend hosted app, no Moderne cloud platform).

## Files

| File | Purpose |
| :--- | :--- |
| [`renovate.jsonc`](./renovate.jsonc) | Portable monorepo Renovate rules (Spring Boot/Jackson + OpenRewrite, Angular + `ng update`, root pnpm, Android/KMP lockstep, Docker Compose, SHA-pinned GitHub Actions, `apps/backstage` exclusion, Blast-Radius auto-merge policy). |
| [`config.js`](./config.js) | Global self-hosted runner config loaded by `renovate/renovate`. Parses `renovate.jsonc`, defaults `dryRun: "full"`, sets `onboarding: false`, and enforces `allowedCommands` with `allowShellExecutorForPostUpgradeCommands: false`. |
| [`docker-compose.yml`](./docker-compose.yml) | Self-hosted `renovate/renovate:full` Docker Compose setup for GitHub `dryRun: "full"` and offline `--platform=local` inspection. |
| [`templates/maven-openrewrite-snippet.xml`](./templates/maven-openrewrite-snippet.xml) | Drop-in `org.openrewrite.maven:rewrite-maven-plugin` (`6.46.1`) + `rewrite-spring` (`6.37.1`) snippet for Maven repositories in other organizations. |

## Local Dry-Run Instructions (Side-by-Side with Dependabot)

### Option 1: Docker Compose — GitHub Full Dry-Run (Recommended)

Simulates branch creation, grouping, OpenRewrite/`ng update` planning, and PR bodies **without** pushing branches or opening PRs:

```bash
export RENOVATE_TOKEN="<read-only-or-repo-github-pat>"
docker compose -f renovate/docker-compose.yml run --rm renovate
```

To inspect structured JSON logs for diffing against `.github/dependabot.yml` open PRs:

```bash
LOG_FORMAT=json LOG_LEVEL=debug \
  docker compose -f renovate/docker-compose.yml run --rm renovate > renovate-dry-run.jsonl
```

### Option 2: Docker Compose — Local Checkout Lookup (No Write Token)

Parses all manifests in your local working tree (`package.json`, `pnpm-lock.yaml`, `package-lock.json`, `apps/pulse/gradle/libs.versions.toml`, `apps/pulse/backend/build.gradle.kts`, `infra/docker-compose.yml`, `.github/workflows/*.yml`) and checks upstream registries:

```bash
docker compose -f renovate/docker-compose.yml --profile local run --rm renovate-local
```

> Note: Renovate's `--platform=local` automatically runs in `dryRun: "lookup"` mode because no remote PR API is active. Pass `GITHUB_COM_TOKEN` if you hit unauthenticated GitHub Actions release-lookup rate limits.

### Option 3: Live PR Creation (Explicit Opt-In)

Only disable `dryRun` after verifying the dry-run output matches expectations:

```bash
RENOVATE_DRY_RUN=false RENOVATE_TOKEN="<repo-write-token>" \
  docker compose -f renovate/docker-compose.yml run --rm renovate
```

Or run the self-hosted GitHub Actions workflow [`.github/workflows/renovate-self-hosted.yml`](../.github/workflows/renovate-self-hosted.yml) via `workflow_dispatch` with `dry_run: false`.

## Auto-Remediation & Blast-Radius Auto-Merge Gate

1. **Spring Boot / Framework / Security / Jackson (`apps/pulse/backend`)**:
   - `renovate/renovate.jsonc` runs `./gradlew --no-daemon rewriteRun` via `postUpgradeTasks` when Spring or Jackson dependencies update.
   - `apps/pulse/backend/build.gradle.kts` integrates `org.openrewrite.rewrite` (`7.39.0`) with `org.openrewrite.recipe:rewrite-spring:6.37.1` and Spring Boot 4 / Spring Security 7 recipes, while preserving `pitest`, `archunit-junit5`, `codeQuality`, and JUnit 5 `test`.
   - **JDK note**: `apps/pulse/backend` uses a Java 21 toolchain. Always run OpenRewrite (`rewriteDryRun` / `rewriteRun`) with a Java 21 `JAVA_HOME` (as configured in CI); running the Gradle daemon under JDK 17 causes OpenRewrite's Java parser to report parse errors on Java 21 sealed-interface `switch` pattern matching (`PulseAccountabilityService.java`, `TriageRules.java`).
2. **Angular 21 (`apps/pulse/web`)**:
   - When `@angular/core` or `@angular/cli` bumps, `postUpgradeTasks` runs `npm ci --ignore-scripts` followed by `npx --no-install ng update {{{depName}}} --migrate-only --from={{{currentVersion}}} --to={{{newVersion}}} --allow-dirty --force`.
3. **Blast-Radius Safety Gate**:
   - `platformAutomerge: true` delegates merging to GitHub's native auto-merge and branch ruleset (`promote & merge`).
   - Required checks: `Release Readiness Scorecard` (`.github/workflows/ci.yml`) and `Blast-Radius AST & Safety Gate` (workflow `Dependency Blast-Radius Gate` in `.github/workflows/blast-radius.yml`, running `@cmp/blast-radius` `--gate`).
   - Only `HIGH CONFIDENCE / AUTO-MERGE` (exit `0`) permits auto-merge; `MODERATE` (exit `10`) and `CRITICAL PATH TOUCHED` (exit `20`) block auto-merge for human review.

## Cross-Organization Portability (Gradle + Maven)

This repository uses **Gradle Kotlin DSL** (`apps/pulse/backend/build.gradle.kts`, `./gradlew`) and has **no `pom.xml`**. To reuse `renovate/renovate.jsonc` across other repositories in your organization:

1. **Gradle repositories**:
   - Copy `renovate/renovate.jsonc` to `.github/renovate.json5` (or root `renovate.json` with comments stripped).
   - Add `id("org.openrewrite.rewrite") version "7.39.0"` and `rewrite("org.openrewrite.recipe:rewrite-spring:6.37.1")` to each Spring service's `build.gradle.kts`.
   - Ensure `./gradlew` resides alongside the root or service `build.gradle.kts` (or adjust `postUpgradeTasks.commands` + `allowedCommands` in `config.js` if invoking a parent wrapper such as `../../gradlew`).
2. **Maven repositories**:
   - Copy the `<plugin>` block from [`templates/maven-openrewrite-snippet.xml`](./templates/maven-openrewrite-snippet.xml) into the target `pom.xml`.
   - `renovate/renovate.jsonc` already includes a matching `matchManagers: ["maven"]` rule that runs `mvn -B -ntp rewrite:run`, and `renovate/config.js` already whitelists `^mvn -B -ntp rewrite:run$`.
3. **Override active OpenRewrite recipes on demand**:
   - Gradle: `./gradlew --no-daemon rewriteDryRun -Prewrite.activeRecipes=org.openrewrite.java.spring.boot4.SpringBootProperties_4_1`
   - Maven: `mvn -B -ntp rewrite:dryRun -Drewrite.activeRecipes=org.openrewrite.java.spring.boot4.SpringBootProperties_4_1`
