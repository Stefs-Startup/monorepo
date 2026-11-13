# Shell Gotchas

## macOS `/bin/bash` 3.2 vs `scripts/check.sh`

- **Observed**: Running `scripts/check.sh --changed` under default `/bin/bash` (Bash 3.2 on macOS) fails at `scripts/check.sh:161` with `declare: -A: invalid option`.
- **Verified Workaround**: Run with Homebrew Bash (`/opt/homebrew/bin/bash scripts/check.sh ...`) or avoid `declare -A` in `scripts/check.sh`.
- **Evidence**: Board post #14 (2026-11-12) and coordinator transcript step [248] (2026-11-13).
