#!/usr/bin/env bash
# =============================================================================
# scripts/check.sh — run the exact CI gates locally, per stack.
#
# CI (.github/workflows/ci-stack-*.yml) is a thin orchestrator over native
# commands. This script is the single local entry point for the same commands,
# so "green locally" means "green in CI" (see docs/local-validation.md).
#
# Usage:
#   scripts/check.sh --changed                 # stacks touched vs. main (+ dirty tree)
#   scripts/check.sh --stack angular           # one stack (repeatable)
#   scripts/check.sh --all                     # every stack
#   scripts/check.sh --changed --gate quality  # Gate 1 only (what pre-push runs)
#   scripts/check.sh --list                    # list stacks and their commands
#
# Options:
#   --gate quality|build|test|all   Which CI gate(s) to run (default: all)
#   --base <ref>                    Diff base for --changed (default: origin/main, then main)
#
# Environment:
#   CHECK_STRICT=1   Fail (instead of skip) when a required tool/SDK is missing.
#   CHECK_INSTALL=0  Never run dependency installs automatically.
#
# Gate mapping (identical to CI):
#   quality = Gate 1 (lint / typecheck / compile / boundary rules)
#   build   = Gate 2
#   test    = Gate 3
# Gate 4 (Deploy & Distribution) only aggregates Gates 1-3 and has no local step.
# =============================================================================
set -uo pipefail
# Auto-detect user or system truststore if default JRE cacerts is absent
if [[ -z "${JAVA_TOOL_OPTIONS:-}" && -f "$HOME/.local/share/ca-certificates/cacerts" ]]; then
  export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=$HOME/.local/share/ca-certificates/cacerts -Djavax.net.ssl.trustStorePassword=changeit"
fi


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ALL_STACKS=(pnpm-turborepo angular springboot android kmp)

GATE="all"
BASE=""
MODE=""
SELECTED=()

usage() { sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --changed) MODE="changed" ;;
    --all) MODE="all" ;;
    --stack) MODE="stack"; shift; SELECTED+=("${1:?--stack needs a name}") ;;
    --gate) shift; GATE="${1:?--gate needs a value}" ;;
    --base) shift; BASE="${1:?--base needs a ref}" ;;
    --list) MODE="list" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

case "$GATE" in quality|build|test|all) ;; *) echo "Invalid --gate: $GATE" >&2; exit 2 ;; esac
[[ -z "$MODE" ]] && { usage >&2; exit 2; }

# --- stack definitions -------------------------------------------------------
# For each stack: working dir, tool requirements, and the command per gate.
# Keep these in sync with .github/workflows/ci-stack-<stack>.yml.
stack_dir() {
  case "$1" in
    pnpm-turborepo) echo "." ;;
    angular)        echo "apps/pulse/web" ;;
    springboot)     echo "apps/pulse/backend" ;;
    android)        echo "apps/pulse" ;;
    kmp)            echo "apps/pulse/kmp" ;;
  esac
}

stack_cmd() { # stack gate
  case "$1:$2" in
    pnpm-turborepo:quality) echo "pnpm run lint && pnpm run typecheck" ;;
    pnpm-turborepo:build)   echo "pnpm run build" ;;
    pnpm-turborepo:test)    echo "pnpm run test" ;;
    angular:quality)        echo "npm run lint && npm run typecheck" ;;
    angular:build)          echo "npm run build" ;;
    angular:test)           echo "npm test" ;;
    springboot:quality)     echo "./gradlew codeQuality --stacktrace" ;;
    springboot:build)       echo "./gradlew bootJar testClasses --stacktrace" ;;
    springboot:test)        echo "./gradlew test --stacktrace" ;;
    android:quality)        echo "./gradlew :app:lintDebug --stacktrace" ;;
    android:build)          echo "./gradlew :app:assembleDebug --stacktrace" ;;
    android:test)           echo "./gradlew :app:testDebugUnitTest --stacktrace" ;;
    kmp:quality)            echo "./gradlew codeQuality --stacktrace" ;;
    kmp:build)              echo "./gradlew jvmJar compileProductionExecutableKotlinWasmJs --stacktrace" ;;
    kmp:test)               echo "./gradlew jvmTest --stacktrace" ;;
  esac
}

# Returns non-zero (with a reason on stdout) when the stack cannot run here.
stack_prereq() {
  case "$1" in
    pnpm-turborepo) command -v pnpm >/dev/null || { echo "pnpm not found"; return 1; } ;;
    angular)        command -v npm  >/dev/null || { echo "npm not found";  return 1; } ;;
    springboot|kmp) command -v java >/dev/null || { echo "JDK not found";  return 1; } ;;
    android)
      command -v java >/dev/null || { echo "JDK not found"; return 1; }
      if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" && ! -f apps/pulse/local.properties ]]; then
        echo "Android SDK not found (set ANDROID_HOME or apps/pulse/local.properties)"; return 1
      fi ;;
  esac
}

# Install dependencies only when they are clearly missing.
stack_install() {
  [[ "${CHECK_INSTALL:-1}" == "0" ]] && return 0
  case "$1" in
    pnpm-turborepo) [[ -d node_modules ]] || pnpm install --frozen-lockfile ;;
    angular)        [[ -d node_modules ]] || npm ci ;;
  esac
}

# Map a changed path to the stack(s) it affects.
path_to_stacks() {
  case "$1" in
    package.json|pnpm-lock.yaml|pnpm-workspace.yaml|turbo.json|.nvmrc|.node-version|apps/web/*|packages/*|.github/workflows/ci-stack-pnpm-turborepo.yml)
      echo pnpm-turborepo ;;
    apps/pulse/web/*|.github/workflows/ci-stack-angular.yml) echo angular ;;
    apps/pulse/backend/*|.github/workflows/ci-stack-springboot-java.yml) echo springboot ;;
    apps/pulse/kmp/*|.github/workflows/ci-stack-kmp-multiplatform.yml) echo kmp ;;
    apps/pulse/app/*|apps/pulse/gradle/*|apps/pulse/build.gradle.kts|apps/pulse/settings.gradle.kts|apps/pulse/gradle.properties|apps/pulse/gradlew*|.github/workflows/ci-stack-android-kotlin.yml)
      echo android ;;
    .github/workflows/reusable-*|.github/scripts/*|scripts/check.sh) echo "${ALL_STACKS[@]}" ;;
  esac
}

changed_files() {
  local base="${BASE:-}"
  if [[ -z "$base" ]]; then
    if git rev-parse --verify -q origin/main >/dev/null; then base="origin/main"
    elif git rev-parse --verify -q main >/dev/null; then base="main"
    else base="HEAD~1"; fi
  fi
  local mb; mb="$(git merge-base "$base" HEAD 2>/dev/null || echo "$base")"
  {
    git diff --name-only "$mb"...HEAD
    git diff --name-only HEAD                        # staged + unstaged
    git ls-files --others --exclude-standard         # untracked
  } | sort -u
}

# --- resolve selection -------------------------------------------------------
case "$MODE" in
  list)
    for s in "${ALL_STACKS[@]}"; do
      echo "[$s] (cd $(stack_dir "$s"))"
      for g in quality build test; do echo "  $g: $(stack_cmd "$s" "$g")"; done
    done
    exit 0 ;;
  all) SELECTED=("${ALL_STACKS[@]}") ;;
  changed)
    declare -A seen=()
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      for s in $(path_to_stacks "$f"); do seen[$s]=1; done
    done < <(changed_files)
    for s in "${ALL_STACKS[@]}"; do [[ -n "${seen[$s]:-}" ]] && SELECTED+=("$s"); done
    if [[ ${#SELECTED[@]} -eq 0 ]]; then echo "✓ No stack-affecting changes; nothing to check."; exit 0; fi ;;
  stack)
    for s in "${SELECTED[@]}"; do
      [[ " ${ALL_STACKS[*]} " == *" $s "* ]] || { echo "Unknown stack: $s (valid: ${ALL_STACKS[*]})" >&2; exit 2; }
    done ;;
esac

if [[ "$GATE" == "all" ]]; then GATES=(quality build test); else GATES=("$GATE"); fi

# --- run ---------------------------------------------------------------------
echo "Stacks: ${SELECTED[*]}  |  Gates: ${GATES[*]}"
RESULTS=(); FAILED=0

for s in "${SELECTED[@]}"; do
  if ! reason="$(stack_prereq "$s")"; then
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [$s] $reason (CHECK_STRICT=1)"; RESULTS+=("FAIL  $s  ($reason)"); FAILED=1
    else
      echo "⚠ [$s] skipped: $reason"; RESULTS+=("SKIP  $s  ($reason)")
    fi
    continue
  fi
  dir="$(stack_dir "$s")"
  ( cd "$dir" && stack_install "$s" ) || { RESULTS+=("FAIL  $s  (dependency install)"); FAILED=1; continue; }
  for g in "${GATES[@]}"; do
    cmd="$(stack_cmd "$s" "$g")"
    echo; echo "━━ [$s] gate:$g → (cd $dir) $cmd"
    start=$SECONDS
    if ( cd "$dir" && bash -c "$cmd" ); then
      RESULTS+=("PASS  $s:$g  ($((SECONDS - start))s)")
    else
      RESULTS+=("FAIL  $s:$g  ($((SECONDS - start))s)"); FAILED=1
      break   # later gates depend on earlier ones
    fi
  done
done

echo; echo "══════════ Summary ══════════"
printf '%s\n' "${RESULTS[@]}"
[[ $FAILED -eq 0 ]] && echo "✓ All selected checks passed." || echo "✗ Some checks failed."
exit $FAILED
