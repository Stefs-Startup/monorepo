# Local Validation (CI Parity)

CI is a thin orchestrator over native commands. `scripts/check.sh` runs those **same commands** locally, so a green local run means a green CI run. Git hooks (Lefthook) call it automatically.

## Quick start

```bash
pnpm install                 # installs deps and registers git hooks (prepare -> lefthook install)

pnpm check                   # all gates for stacks changed vs. main (incl. uncommitted work)
pnpm check:all               # every stack, every gate
scripts/check.sh --stack angular --gate quality
scripts/check.sh --list      # show the exact command behind every stack/gate
```

## Stacks and gates

| Stack (`--stack`) | Directory | Gate 1 `quality` | Gate 2 `build` | Gate 3 `test` |
|---|---|---|---|---|
| `pnpm-turborepo` | `.` | `pnpm run lint && pnpm run typecheck` | `pnpm run build` | `pnpm run test` |
| `angular` | `apps/pulse/web` | `npm run lint && npm run typecheck` | `npm run build` | `npm test` |
| `springboot` | `apps/pulse/backend` | `./gradlew codeQuality` | `./gradlew bootJar testClasses` | `./gradlew test` |
| `android` | `apps/pulse` | `./gradlew :app:lintDebug` | `./gradlew :app:assembleDebug` | `./gradlew :app:testDebugUnitTest` |
| `kmp` | `apps/pulse/kmp` | `./gradlew codeQuality` | `./gradlew jvmJar compileProductionExecutableKotlinWasmJs` | `./gradlew jvmTest` |
| `ytm-menubar` | `apps/ytm-menubar` | `swift build --build-system native` (`MacOSX26.5.sdk`) | `swift build --build-system native` (`MacOSX26.5.sdk`) | `swift test --build-system native` (with `Testing.framework` `-F` flags) |

`pnpm-turborepo` covers `apps/web`, `packages/*`, and `tools/*` (`@cmp/blast-radius`, `@cmp/blast-radius-ui`). `scripts/check.sh --changed` maps changes under `tools/*` to `pnpm-turborepo`, matching `.github/workflows/ci-stack-pnpm-turborepo.yml`.

## Affected-Only CI Discovery (`STE-40`)

`.github/workflows/ci.yml` passes `--base-ref "origin/$BASE_REF"` to `.github/scripts/discover_projects.py` on `pull_request` events so CI only schedules impacted Gradle and Node projects (with `turbo --filter=...[<base_ref>]` on root workspace member changes), while pushes to `main` and `merge_group` run `--all` without filtering:

```bash
# Docs-only change returns zero Gradle/Node jobs
python3 .github/scripts/discover_projects.py --changed-files docs/README.md --json

# Shared package change triggers root workspace with Turborepo filter
python3 .github/scripts/discover_projects.py --changed-files packages/utils/src/index.ts --json

# Run full matrix (main pushes / merge_group)
python3 .github/scripts/discover_projects.py --all --json

# Unit tests for discovery and affected-only filtering
CI=true python3 -m unittest discover -s .github/scripts -p 'test_*.py' -v
```

Gate 4 (Release Readiness Scorecard) only aggregates Gates 1-3, so it has no local step.

### Repo-wide & SOTA QE gates (`--gate`)

| Gate (`--gate`) | Scope | What it runs | Behavior when tool is missing |
|---|---|---|---|
| `security` | Repo-wide | `gitleaks protect --staged --no-banner` + `osv-scanner scan -r .` | `SKIP` (or `FAIL` with `CHECK_STRICT=1`) |
| `arch` | JS/TS & JVM | `dependency-cruiser` (JS/TS module boundaries) / ArchUnit (`./gradlew test`) | `SKIP` (or `FAIL` with `CHECK_STRICT=1`) |
| `a11y` | `apps/web` | Playwright + `@axe-core/playwright` (`test:a11y`, WCAG 2.2 AA) | `SKIP` (or `FAIL` with `CHECK_STRICT=1`) |
| `mutation` | JS/TS & JVM | Stryker (`stryker.config.mjs`) / PITest | `SKIP` (or `FAIL` with `CHECK_STRICT=1`) |
| `contract` | `apps/pulse` | `scripts/api-contract.sh check` + `scripts/api-contract.sh breaking` (`oasdiff`, or auto/builtin [`openapi-diff-fallback.mjs`](../scripts/openapi-diff-fallback.mjs)) | Uses `oasdiff`/Docker or falls back to `builtin` Node diff (`CHECK_STRICT=1` enforces `CONTRACT_DIFF_TOOL=oasdiff` if explicitly requested) |

Example:

```bash
scripts/check.sh --gate security
scripts/check.sh --gate arch
scripts/check.sh --gate a11y
scripts/check.sh --gate mutation
scripts/check.sh --gate contract
```

## Contract-First OpenAPI 3.1 Sync & Breaking-Change Drill (`ADR-0005`)

When modifying `apps/pulse/backend` REST controllers/DTOs or `apps/pulse/contracts/pulse-api.openapi.json`:

```bash
# Re-export OpenAPI 3.1 spec + regenerate Angular TS types + KMP Kotlin models
/bin/bash scripts/api-contract.sh sync

# Verify zero drift + run OpenAPI breaking-change check against origin/main (oasdiff default, or builtin Node fallback)
scripts/check.sh --gate contract
CONTRACT_DIFF_TOOL=builtin /bin/bash scripts/api-contract.sh drill

# Run non-destructive Expand vs. Breaking Catch learning drill
/bin/bash scripts/api-contract.sh drill
```

In CI, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs [`.github/workflows/ci-contract-pulse-api.yml`](../.github/workflows/ci-contract-pulse-api.yml) (`contracts` job) and surfaces sync, breaking-change, and changelog state directly inside the `Release Readiness Scorecard` step summary and sticky `<!-- cmp-release-readiness-scorecard -->` PR comment.

## Git hooks (Lefthook)

| Hook | Runs | Budget |
|---|---|---|
| `pre-commit` | Staged files only: no `@ts-ignore`, no secret-like files, `bash -n` on shell scripts, `actionlint` if installed | ~2s |
| `pre-push` | `scripts/check.sh --changed --gate quality` (Gate 1 of only the stacks in the outgoing diff) | seconds to ~2 min |

Hooks never build or run tests on commit. Gate 1 includes Kotlin/Java compilation (`lintDebug`, `codeQuality`) and TypeScript typechecks, which catch the most common CI breakages (missing imports, unbuilt workspace types) before they reach GitHub.

Bypass in an emergency: `LEFTHOOK=0 git push` or `git push --no-verify`. CI remains the source of truth.

## Environment variables

| Variable | Effect |
|---|---|
| `CHECK_STRICT=1` | Fail instead of skipping a stack whose toolchain (JDK, Android SDK, pnpm) is missing |
| `CHECK_INSTALL=0` | Never auto-run `pnpm install` / `npm ci` |

Without `CHECK_STRICT`, stacks whose toolchain is missing are skipped with a warning (for example, no Android SDK on a backend developer's machine).

## Keeping it in sync

When you change a command in `.github/workflows/ci-stack-*.yml`, update `stack_cmd` in `scripts/check.sh` and the table above. New stacks: add them to `ALL_STACKS`, `stack_dir`, `stack_cmd`, `stack_prereq`, and `path_to_stacks`.

## When to use `nektos/act`

Only for debugging workflow YAML itself (matrix syntax, cache keys, action inputs). It is not the code-validation path.

## Dependency Blast-Radius & Renovate Validation

When modifying dependency manifests, lockfiles, or Renovate/Blast-Radius tooling:

```bash
# Build @cmp/blast-radius and generate JSON + Markdown blast-radius reports
pnpm --filter @cmp/blast-radius... build
pnpm blast-radius -- --base origin/main --out blast-radius-report.json --md-out blast-radius-report.md

# Enforce the CI auto-merge safety gate locally (0=HIGH, 10=MODERATE, 20=CRITICAL PATH)
pnpm blast-radius -- --base origin/main --gate

# Inspect the generated report in the local React Flow viewer (http://127.0.0.1:4173/)
pnpm blast-ui -- --report blast-radius-report.json

# Validate self-hosted Renovate OSS configuration without pushing branches
node -e 'const cfg = require("./renovate/config.js"); console.log("dryRun:", cfg.dryRun, "rules:", cfg.packageRules.length);'
docker compose -f renovate/docker-compose.yml config -q
```

In CI, [`.github/workflows/blast-radius.yml`](../.github/workflows/blast-radius.yml) runs `@cmp/blast-radius` on dependency-touching PRs, uploads `blast-radius-report.json`, posts/updates the sticky `<!-- cmp-blast-radius-report -->` PR comment, and runs the `--gate` safety check.
