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
#   --gate quality|build|test|security|arch|a11y|mutation|all
#                                            Which CI gate(s) to run (default: all)
#   --base <ref>                             Diff base for --changed (default: origin/main, then main)
#
# Environment:
#   CHECK_STRICT=1   Fail (instead of skip) when a required tool/SDK is missing.
#   CHECK_INSTALL=0  Never run dependency installs automatically.
#
# Gate mapping (identical to CI):
#   quality  = Gate 1 (lint / typecheck / compile / boundary rules)
#   build    = Gate 2
#   test     = Gate 3
#   security = optional local security gate (gitleaks staged + osv-scanner)
#   arch     = architecture fitness gate (dependency-cruiser + ArchUnit)
#   a11y     = accessibility E2E gate (apps/web Playwright a11y)
#   mutation = mutation testing gate (Stryker + Pitest)
# Gate 4 (Deploy & Distribution) only aggregates Gates 1-3 and has no local step.
# =============================================================================
set -uo pipefail
# Auto-detect user or system truststore if default JRE cacerts is absent
if [[ -z "${JAVA_TOOL_OPTIONS:-}" && -f "$HOME/.local/share/ca-certificates/cacerts" ]]; then
  export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=$HOME/.local/share/ca-certificates/cacerts -Djavax.net.ssl.trustStorePassword=changeit"
fi


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ALL_STACKS=(pnpm-turborepo angular springboot android kmp ytm-menubar)

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

case "$GATE" in quality|build|test|security|arch|a11y|mutation|all) ;; *) echo "Invalid --gate: $GATE" >&2; exit 2 ;; esac
if [[ -z "$MODE" ]]; then
  case "$GATE" in
    security|arch|a11y|mutation) MODE="$GATE" ;;
    *) usage >&2; exit 2 ;;
  esac
fi

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
    ytm-menubar)    echo "apps/ytm-menubar" ;;
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
    ytm-menubar:quality)    echo "SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift build --build-system native" ;;
    ytm-menubar:build)      echo "SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift build --build-system native" ;;
    ytm-menubar:test)       echo "SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift test --build-system native -Xswiftc -F -Xswiftc /Library/Developer/CommandLineTools/Library/Developer/Frameworks -Xlinker -F -Xlinker /Library/Developer/CommandLineTools/Library/Developer/Frameworks" ;;
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
    ytm-menubar)
      command -v swift >/dev/null || { echo "swift not found"; return 1; }
      if [[ ! -d "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk" ]]; then
        echo "MacOSX26.5.sdk not found at /Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"; return 1
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
    package.json|pnpm-lock.yaml|pnpm-workspace.yaml|turbo.json|.nvmrc|.node-version|apps/web/*|packages/*|tools/*|.github/workflows/ci-stack-pnpm-turborepo.yml)
      echo pnpm-turborepo ;;
    apps/pulse/web/*|.github/workflows/ci-stack-angular.yml) echo angular ;;
    apps/pulse/backend/*|.github/workflows/ci-stack-springboot-java.yml) echo springboot ;;
    apps/pulse/kmp/*|.github/workflows/ci-stack-kmp-multiplatform.yml) echo kmp ;;
    apps/pulse/app/*|apps/pulse/gradle/*|apps/pulse/build.gradle.kts|apps/pulse/settings.gradle.kts|apps/pulse/gradle.properties|apps/pulse/gradlew*|.github/workflows/ci-stack-android-kotlin.yml)
      echo android ;;
    apps/ytm-menubar/*) echo ytm-menubar ;;
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
  security|arch|a11y|mutation) SELECTED=() ;;
  changed)
    seen_list=""
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      for s in $(path_to_stacks "$f"); do
        case " $seen_list " in
          *" $s "*) ;;
          *) seen_list="$seen_list $s" ;;
        esac
      done
    done < <(changed_files)
    for s in "${ALL_STACKS[@]}"; do
      case " $seen_list " in
        *" $s "*) SELECTED+=("$s") ;;
      esac
    done
    if [[ ${#SELECTED[@]} -eq 0 && "$GATE" != "security" && "$GATE" != "arch" && "$GATE" != "a11y" && "$GATE" != "mutation" ]]; then
      echo "✓ No stack-affecting changes; nothing to check."; exit 0
    fi ;;
  stack)
    for s in "${SELECTED[@]}"; do
      [[ " ${ALL_STACKS[*]} " == *" $s "* ]] || { echo "Unknown stack: $s (valid: ${ALL_STACKS[*]})" >&2; exit 2; }
    done ;;
esac

if [[ "$GATE" == "security" ]]; then
  echo "Gate: security (repo-wide)"
  RESULTS=(); FAILED=0
  for tool in gitleaks osv-scanner; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
        echo "✗ [security:$tool] $tool not installed (CHECK_STRICT=1)"
        RESULTS+=("FAIL  security:$tool  ($tool not installed)")
        FAILED=1
      else
        echo "⚠ [security:$tool] skipped: $tool not installed"
        RESULTS+=("SKIP  security:$tool  ($tool not installed)")
      fi
      continue
    fi
    start=$SECONDS
    case "$tool" in
      gitleaks)
        echo; echo "━━ [security] gitleaks protect --staged --no-banner"
        if gitleaks protect --staged --no-banner; then
          RESULTS+=("PASS  security:gitleaks  ($((SECONDS - start))s)")
        else
          RESULTS+=("FAIL  security:gitleaks  ($((SECONDS - start))s)"); FAILED=1
        fi ;;
      osv-scanner)
        echo; echo "━━ [security] osv-scanner scan -r ."
        if osv-scanner scan -r .; then
          RESULTS+=("PASS  security:osv-scanner  ($((SECONDS - start))s)")
        else
          RESULTS+=("FAIL  security:osv-scanner  ($((SECONDS - start))s)"); FAILED=1
        fi ;;
    esac
  done
  echo; echo "══════════ Summary ══════════"
  printf '%s\n' "${RESULTS[@]}"
  [[ $FAILED -eq 0 ]] && echo "✓ Security gate passed." || echo "✗ Security gate failed."
  exit $FAILED
fi

if [[ "$GATE" == "arch" ]]; then
  echo "Gate: arch (repo-wide)"
  RESULTS=(); FAILED=0

  if [[ ! -f ".dependency-cruiser.cjs" ]]; then
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [arch:dependency-cruiser] .dependency-cruiser.cjs not found (CHECK_STRICT=1)"
      RESULTS+=("FAIL  arch:dependency-cruiser  (config missing)"); FAILED=1
    else
      echo "⚠ [arch:dependency-cruiser] skipped: .dependency-cruiser.cjs not found"
      RESULTS+=("SKIP  arch:dependency-cruiser  (config missing)")
    fi
  elif ! command -v npx >/dev/null 2>&1; then
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [arch:dependency-cruiser] npx not installed (CHECK_STRICT=1)"
      RESULTS+=("FAIL  arch:dependency-cruiser  (npx not installed)"); FAILED=1
    else
      echo "⚠ [arch:dependency-cruiser] skipped: npx not installed"
      RESULTS+=("SKIP  arch:dependency-cruiser  (npx not installed)")
    fi
  else
    start=$SECONDS
    echo; echo "━━ [arch] npx --yes dependency-cruiser --config .dependency-cruiser.cjs packages apps"
    if npx --yes dependency-cruiser --config .dependency-cruiser.cjs packages apps; then
      RESULTS+=("PASS  arch:dependency-cruiser  ($((SECONDS - start))s)")
    else
      RESULTS+=("FAIL  arch:dependency-cruiser  ($((SECONDS - start))s)"); FAILED=1
    fi
  fi

  if [[ ! -x "apps/pulse/backend/gradlew" ]] || ! command -v java >/dev/null 2>&1; then
    reason="apps/pulse/backend/gradlew or JDK not available"
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [arch:archunit] $reason (CHECK_STRICT=1)"
      RESULTS+=("FAIL  arch:archunit  ($reason)"); FAILED=1
    else
      echo "⚠ [arch:archunit] skipped: $reason"
      RESULTS+=("SKIP  arch:archunit  ($reason)")
    fi
  else
    start=$SECONDS
    echo; echo "━━ [arch] (cd apps/pulse/backend) ./gradlew test --stacktrace"
    if ( cd apps/pulse/backend && ./gradlew test --stacktrace ); then
      RESULTS+=("PASS  arch:archunit  ($((SECONDS - start))s)")
    else
      RESULTS+=("FAIL  arch:archunit  ($((SECONDS - start))s)"); FAILED=1
    fi
  fi

  echo; echo "══════════ Summary ══════════"
  printf '%s\n' "${RESULTS[@]}"
  [[ $FAILED -eq 0 ]] && echo "✓ Architecture gate passed." || echo "✗ Architecture gate failed."
  exit $FAILED
fi

if [[ "$GATE" == "a11y" ]]; then
  echo "Gate: a11y (apps/web)"
  RESULTS=(); FAILED=0

  if [[ ! -d "apps/web" ]]; then
    echo "✗ [a11y:playwright] apps/web directory missing"
    RESULTS+=("FAIL  a11y:playwright  (apps/web missing)"); FAILED=1
  elif [[ ! -x "apps/web/node_modules/.bin/playwright" ]] && ! ( cd apps/web && node -e "require.resolve('@playwright/test')" >/dev/null 2>&1 ); then
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [a11y:playwright] Playwright not installed in apps/web (CHECK_STRICT=1)"
      RESULTS+=("FAIL  a11y:playwright  (Playwright not installed)"); FAILED=1
    else
      echo "⚠ [a11y:playwright] skipped: Playwright not installed in apps/web"
      RESULTS+=("SKIP  a11y:playwright  (Playwright not installed)")
    fi
  else
    start=$SECONDS
    echo; echo "━━ [a11y] (cd apps/web) npx playwright test e2e/a11y.spec.ts"
    if ( cd apps/web && npx playwright test e2e/a11y.spec.ts ); then
      RESULTS+=("PASS  a11y:playwright  ($((SECONDS - start))s)")
    else
      RESULTS+=("FAIL  a11y:playwright  ($((SECONDS - start))s)"); FAILED=1
    fi
  fi

  echo; echo "══════════ Summary ══════════"
  printf '%s\n' "${RESULTS[@]}"
  [[ $FAILED -eq 0 ]] && echo "✓ A11y gate passed." || echo "✗ A11y gate failed."
  exit $FAILED
fi

if [[ "$GATE" == "mutation" ]]; then
  echo "Gate: mutation (repo-wide)"
  RESULTS=(); FAILED=0

  if [[ ! -f "stryker.config.mjs" ]]; then
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [mutation:stryker] stryker.config.mjs not found (CHECK_STRICT=1)"
      RESULTS+=("FAIL  mutation:stryker  (config missing)"); FAILED=1
    else
      echo "⚠ [mutation:stryker] skipped: stryker.config.mjs not found"
      RESULTS+=("SKIP  mutation:stryker  (config missing)")
    fi
  elif [[ ! -x "node_modules/.bin/stryker" ]] && ! npx --no-install stryker --version >/dev/null 2>&1; then
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [mutation:stryker] stryker not installed (CHECK_STRICT=1)"
      RESULTS+=("FAIL  mutation:stryker  (stryker not installed)"); FAILED=1
    else
      echo "⚠ [mutation:stryker] skipped: stryker not installed"
      RESULTS+=("SKIP  mutation:stryker  (stryker not installed)")
    fi
  else
    start=$SECONDS
    echo; echo "━━ [mutation] npx stryker run stryker.config.mjs"
    if npx stryker run stryker.config.mjs; then
      RESULTS+=("PASS  mutation:stryker  ($((SECONDS - start))s)")
    else
      RESULTS+=("FAIL  mutation:stryker  ($((SECONDS - start))s)"); FAILED=1
    fi
  fi

  if [[ ! -x "apps/pulse/backend/gradlew" ]] || ! command -v java >/dev/null 2>&1 || ! grep -q "pitest" apps/pulse/backend/build.gradle* 2>/dev/null; then
    reason="pitest or JDK not configured in apps/pulse/backend"
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ [mutation:pitest] $reason (CHECK_STRICT=1)"
      RESULTS+=("FAIL  mutation:pitest  ($reason)"); FAILED=1
    else
      echo "⚠ [mutation:pitest] skipped: $reason"
      RESULTS+=("SKIP  mutation:pitest  ($reason)")
    fi
  else
    start=$SECONDS
    echo; echo "━━ [mutation] (cd apps/pulse/backend) ./gradlew pitest --stacktrace"
    if ( cd apps/pulse/backend && ./gradlew pitest --stacktrace ); then
      RESULTS+=("PASS  mutation:pitest  ($((SECONDS - start))s)")
    else
      RESULTS+=("FAIL  mutation:pitest  ($((SECONDS - start))s)"); FAILED=1
    fi
  fi

  echo; echo "══════════ Summary ══════════"
  printf '%s\n' "${RESULTS[@]}"
  [[ $FAILED -eq 0 ]] && echo "✓ Mutation gate passed." || echo "✗ Mutation gate failed."
  exit $FAILED
fi

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
