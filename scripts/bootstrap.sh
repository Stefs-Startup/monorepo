#!/usr/bin/env bash
# =============================================================================
# Reproducible Sandbox / Fresh Worktree Bootstrap (STE-53)
# =============================================================================
# Usage:
#   ./scripts/bootstrap.sh                # setup tools (if mise present), verify parity & changed stacks
#   ./scripts/bootstrap.sh --all          # run scripts/check.sh --all after setup
#   ./scripts/bootstrap.sh --check-only   # read-only parity + discovery + local binary audit
#
# Environment:
#   BOOTSTRAP_STRICT=1  Fail if local node/pnpm/java versions differ from mise.toml
# =============================================================================

set -euo pipefail

export CI=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

CHECK_ONLY=0
CHECK_ALL=0

for arg in "$@"; do
  case "$arg" in
    --check-only)
      CHECK_ONLY=1
      ;;
    --all)
      CHECK_ALL=1
      ;;
    --help|-h)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

echo "==> Monorepo root: $ROOT_DIR"

if command -v mise >/dev/null 2>&1; then
  if [ "$CHECK_ONLY" -eq 0 ]; then
    echo "==> Activating and installing pinned toolchains via mise.toml..."
    mise trust --yes >/dev/null 2>&1 || true
    mise install --yes
  fi
  eval "$(mise env -s bash 2>/dev/null || true)"
else
  echo "INFO: 'mise' not found on PATH; using host-installed toolchains."
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required to verify toolchain parity." >&2
  exit 1
fi

echo "==> Checking mise.toml parity against repo manifests and CI workflows..."
node scripts/check-toolchain-parity.mjs

echo "==> Inspecting local runtime versions vs mise.toml pins..."
LOCAL_DRIFT=0
NODE_VER="$(node -v 2>/dev/null || echo missing)"
PNPM_VER="$(pnpm -v 2>/dev/null || echo missing)"
JAVA_LINE="$(java -version 2>&1 | head -n 1 || echo missing)"
PY_VER="$(python3 --version 2>&1 || echo missing)"

echo "  node    : $NODE_VER (mise pin: 20)"
echo "  pnpm    : $PNPM_VER (mise pin: 9.12.3)"
echo "  java    : $JAVA_LINE (mise pin: 21; KMP: 17)"
echo "  python3 : $PY_VER"

case "$NODE_VER" in
  v20.*) ;;
  *) echo "WARN: host node is $NODE_VER (CI/mise pins Node 20)"; LOCAL_DRIFT=1 ;;
esac

if [ "$PNPM_VER" != "9.12.3" ]; then
  echo "WARN: host pnpm is $PNPM_VER (CI/mise pins pnpm 9.12.3)"
  LOCAL_DRIFT=1
fi

case "$JAVA_LINE" in
  *\"21.*) ;;
  *) echo "WARN: host java is '$JAVA_LINE' (CI/mise pins JDK 21)"; LOCAL_DRIFT=1 ;;
esac

if [ "${BOOTSTRAP_STRICT:-0}" = "1" ] && [ "$LOCAL_DRIFT" -ne 0 ]; then
  echo "ERROR: Host toolchain versions differ from mise.toml pins (BOOTSTRAP_STRICT=1)." >&2
  exit 1
fi

echo "==> Running CI project discovery..."
python3 .github/scripts/discover_projects.py

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "PASS: bootstrap --check-only completed cleanly."
  exit 0
fi

if command -v pnpm >/dev/null 2>&1; then
  if [ ! -d node_modules ]; then
    echo "==> Installing root workspace dependencies (pnpm install --frozen-lockfile)..."
    pnpm install --frozen-lockfile
  fi
else
  echo "WARN: pnpm not installed; skipping root workspace dependency install."
fi

if [ "$CHECK_ALL" -eq 1 ]; then
  echo "==> Running full monorepo CI-parity gates (scripts/check.sh --all)..."
  ./scripts/check.sh --all
else
  echo "==> Running changed-stack CI-parity gates (scripts/check.sh --changed)..."
  ./scripts/check.sh --changed
fi
