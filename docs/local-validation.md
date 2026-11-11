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

Gate 4 (Deploy & Distribution) only aggregates Gates 1-3, so it has no local step.

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
