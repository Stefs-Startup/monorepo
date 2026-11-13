# Agent Guidelines (monorepo root)

## Validate before you push

Run the CI gates locally; they are the same commands CI runs (see `docs/local-validation.md`):

```bash
scripts/check.sh --changed                  # all gates for stacks you touched
scripts/check.sh --stack <name> --gate quality
scripts/check.sh --list                     # stacks: pnpm-turborepo, angular, springboot, android, kmp
```

- Git hooks (Lefthook) run Gate 1 on `git push` for changed stacks. Do not bypass with `--no-verify` / `LEFTHOOK=0` unless the user asks.
- If a stack is reported as `SKIP` (missing JDK/Android SDK), say so in your summary rather than claiming it passed. Use `CHECK_STRICT=1` to make this an error.
- Never push a stack change without Gate 1 passing for that stack.
- When you change `.github/workflows/ci-stack-*.yml`, update `scripts/check.sh` and `docs/local-validation.md`.

Stack-specific guidance: `apps/pulse/AGENTS.md`.
