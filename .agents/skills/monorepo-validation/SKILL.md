---
name: monorepo-validation
description: Standard validation, toolchain parity, and workflow conventions for Stefs-Startup/monorepo. Use before committing or opening a PR across any stack (pnpm/Turborepo, Angular, Spring Boot, Android, KMP, or GitHub Actions).
---

# Monorepo Validation & Conventions

Follow this checklist whenever making code, workflow, or configuration changes in `Stefs-Startup/monorepo`.

## 1. Local CI-Parity Validation

Run the local script matching CI gates before committing or pushing:

```bash
# Validate only stacks touched vs origin/main (+ uncommitted files)
scripts/check.sh --changed

# Validate Gate 1 (quality) quickly across changed stacks
scripts/check.sh --changed --gate quality

# Validate a specific stack
scripts/check.sh --stack pnpm-turborepo
scripts/check.sh --stack angular
scripts/check.sh --stack springboot
scripts/check.sh --stack android
scripts/check.sh --stack kmp
```

If `pnpm` is not in a non-interactive shell `PATH`, invoke `npx --yes pnpm@9.12.3 <command>` for root workspace tasks.

## 2. Toolchain Parity & Sandbox Check

Whenever changing Node, pnpm, Java, Kotlin, or Android SDK versions, run:

```bash
node scripts/check-toolchain-parity.mjs
CI=true node --test scripts/check-toolchain-parity.test.mjs
./scripts/bootstrap.sh --check-only
```

Update `mise.toml` and the matching stack manifest together so `check-toolchain-parity.mjs` never drifts.

## 3. Factory Guardrails & Architecture Boundaries

Before finalizing changes to `packages/*` or `apps/*`:

```bash
pnpm --filter @cmp/factory... build
pnpm verify:slice
pnpm arch:check
pnpm scorecard
```

## 4. Workspace & Security Invariants

1. **Preserve `apps/pulse` isolation**: `pnpm-workspace.yaml` excludes `apps/pulse/**`. Do not add `apps/pulse/web` (`npm` + `package-lock.json`) or Gradle sub-apps into the root pnpm workspace.
2. **Pin all GitHub Actions `uses:` by 40-char commit SHA**: `scorecard` enforces 100% SHA pinning across `.github/workflows/*.yml`.
3. **Never interpolate `${{ ... }}` directly inside `run:` blocks**: Pass GitHub context/inputs via step `env:` variables.
4. **Enforce Linear PR discipline**: Automated/agent PRs must target an `agent-ready` Linear issue (`STE-XX`), use a Linear branch slug, and keep one open PR per issue (`agent-pr-guard.yml`).
