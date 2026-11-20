# CI Reusable Workflows

Language-level GitHub Actions workflows that any repository in the `Stefs-Startup` organization can call.
Each one runs **Code Quality → Build → Test** for a single project directory and uploads its build outputs.
The monorepo's own [`ci.yml`](../.github/workflows/ci.yml) calls them for every discovered project
(see [ADR-0003](adr/0003-monorepo-ci-cd-and-dependabot.md)).

| Workflow | Languages / stacks | Detects |
| :--- | :--- | :--- |
| [`reusable-node.yml`](../.github/workflows/reusable-node.yml) | JavaScript, TypeScript, Angular, React, Turborepo | npm / pnpm / yarn from the lockfile; Node from `.nvmrc` / `.node-version` |
| [`reusable-gradle.yml`](../.github/workflows/reusable-gradle.yml) | Java, Kotlin, Spring Boot, Android | Android vs. plain JVM from the build scripts |

> [!NOTE]
> While `Stefs-Startup/monorepo` is private, other repositories can call these workflows only after
> **Settings → Actions → General → Access → "Accessible from repositories in the `Stefs-Startup` organization"** is enabled.
> Pin external callers to `@v1` (or an immutable `@v1.0.0` / commit SHA) once `v1` tags are cut; `@main` works until then.

---

## Node (`reusable-node.yml`)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  web:
    uses: Stefs-Startup/monorepo/.github/workflows/reusable-node.yml@main
    with:
      working-directory: apps/web   # default "."
```

**Script contract.** Define any of these in `package.json`; the ones you don't define are skipped:

| Script | Gate |
| :--- | :--- |
| `lint` | Code Quality |
| `typecheck` | Code Quality |
| `build` | Build |
| `test` | Test (runs with `CI=true`) |

| Input | Default | Notes |
| :--- | :--- | :--- |
| `working-directory` | `.` | Must contain `package.json` and a lockfile. |
| `node-version` | *(auto)* | `<dir>/.nvmrc` → `<dir>/.node-version` → repo-root `.nvmrc` → `lts/*`. |
| `pnpm-version` | *(auto)* | Only needed without a `packageManager` field. |
| `scripts` | `lint typecheck build test` | Order matters. |
| `artifact-paths` | `dist` | Newline-separated globs relative to `working-directory`. |
| `artifact-name` | `node-<dir>` | |
| `timeout-minutes` | `25` | |

## Gradle (`reusable-gradle.yml`)

```yaml
jobs:
  api:
    uses: Stefs-Startup/monorepo/.github/workflows/reusable-gradle.yml@main
    with:
      working-directory: services/api   # directory containing gradlew
```

| Project type | Code Quality | Build | Test |
| :--- | :--- | :--- | :--- |
| `android` | `lintDebug` | `assembleDebug` | `testDebugUnitTest` |
| `jvm` | *(skipped)* | `assemble testClasses` | `test` |

| Input | Default | Notes |
| :--- | :--- | :--- |
| `working-directory` | `.` | Must contain `gradlew`. |
| `java-version` | `21` | Newline-separated list for multiple JDKs; the last one is `JAVA_HOME`. |
| `project-type` | `auto` | `auto`, `android` or `jvm`. |
| `quality-tasks` / `build-tasks` / `test-tasks` | `default` | `default` = table above; `""` skips the gate; anything else replaces it (e.g. `ktlintCheck detekt`). |
| `artifact-name` | `gradle-<dir>` | APK/AAB/JAR outputs; reports go to `<name>-reports`. |
| `timeout-minutes` | `30` | |

---

## Inside this monorepo

You don't write a job per app. [`discover_projects.py`](../.github/scripts/discover_projects.py) finds:

- every tracked `gradlew` → `reusable-gradle.yml`
- every `package.json` with its own lockfile (including the root pnpm workspace) → `reusable-node.yml`

Preview what CI will run:

```bash
python3 .github/scripts/discover_projects.py
```

Exclude experimental projects, or override a project's inputs, in [`.github/ci-projects.json`](../.github/ci-projects.json):

```json
{
  "exclude": ["apps/backstage"],
  "overrides": {
    "apps/pulse/backend": { "quality-tasks": "spotlessCheck" }
  }
}
```

Branch protection should require only the **Deploy & Distribution** check. The per-project job names change as apps are added.

---

## v1 Versioning Readiness & Release Checklist (STE-39)

### Audit Summary

| Workflow | Scope | Action Pinning | Permissions | v1 Readiness |
| :--- | :--- | :--- | :--- | :--- |
| [`reusable-node.yml`](../.github/workflows/reusable-node.yml) | Org-wide | All `uses:` pinned to commit SHAs | `contents: read` | Ready (`working-directory`, `node-version`, `scripts`, `turbo-filter` configurable) |
| [`reusable-gradle.yml`](../.github/workflows/reusable-gradle.yml) | Org-wide | All `uses:` pinned to commit SHAs | `contents: read` | Ready (`auto \| android \| kmp \| jvm` detection, configurable task gates) |
| [`reusable-web-preview.yml`](../.github/workflows/reusable-web-preview.yml) | Monorepo-internal | All `uses:` pinned to commit SHAs | `contents: read`, `id-token: write`, `pull-requests: write` | Internal only (expects `infra/deploy/services.json`, `scripts/deploy.sh`, `scripts/smoke-test.sh`) |

### Checklist for Cutting `v1.0.0` / Moving `v1` Tag

1. **Enable Organization Actions Access** (required while `Stefs-Startup/monorepo` is private):
   - In GitHub: **Settings → Actions → General → Access** → select **Accessible from repositories in the `Stefs-Startup` organization** → **Save**.
2. **Cut `v1.0.0` and the moving `v1` major tag** from a green `main` commit:
   ```bash
   git checkout main && git pull --ff-only
   git tag -a v1.0.0 -m "chore(release): reusable workflows v1.0.0"
   git tag -fa v1 -m "chore(release): update v1 floating tag to v1.0.0"
   git push origin v1.0.0
   git push origin v1 --force
   ```
   - For subsequent non-breaking fixes (`v1.0.1`, `v1.1.0`), create the immutable `v1.x.y` tag and fast-forward/force-update `v1` to point to it.
   - Any breaking input, output, or secret contract change requires cutting `v2.0.0` / `v2` rather than breaking `v1` callers.
3. **Update External Repository Callers** to pin `@v1` (or `@v1.0.0` / commit SHA):
   ```yaml
   uses: Stefs-Startup/monorepo/.github/workflows/reusable-node.yml@v1
   ```
4. **Verify Cross-Repo Execution**: trigger a workflow run in a consumer repo (or via `workflow_dispatch`) and confirm `reusable-node.yml@v1` / `reusable-gradle.yml@v1` resolves without permission errors.
