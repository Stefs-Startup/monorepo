#!/usr/bin/env bash
# =============================================================================
# scripts/api-contract.sh — RFC-0003 / ADR-0005 Contract-First OpenAPI 3.1 Loop
#
# Single entry point for keeping Spring Boot 4 (producer), Angular 21 (TS client),
# Kotlin Multiplatform (JVM + wasmJs models), and oasdiff breaking-change checks
# synchronized locally and in CI.
#
# Usage:
#   scripts/api-contract.sh sync
#   scripts/api-contract.sh check
#   scripts/api-contract.sh breaking [--base <git-ref-or-file>] [--revision <file>]
#   scripts/api-contract.sh changelog [--base <git-ref-or-file>] [--revision <file>]
#   scripts/api-contract.sh drill
#
# Environment:
#   CONTRACT_DIFF_TOOL=auto|oasdiff|builtin  (default: auto -> oasdiff, docker, else builtin Node diff)
# =============================================================================
set -euo pipefail

export PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH"

if [[ -z "${JAVA_TOOL_OPTIONS:-}" && -f "$HOME/.local/share/ca-certificates/cacerts" ]]; then
  export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=$HOME/.local/share/ca-certificates/cacerts -Djavax.net.ssl.trustStorePassword=changeit"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SPEC_REL="apps/pulse/contracts/pulse-api.openapi.json"
WEB_GEN_REL="apps/pulse/web/src/app/api/generated"
KMP_GEN_REL="apps/pulse/kmp/src/commonMain/kotlin/com/pulse/kmp/api/generated"

usage() {
  sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "✗ Missing required command: $1" >&2
    exit 1
  fi
}

DIFF_TOOL="${CONTRACT_DIFF_TOOL:-auto}"
case "$DIFF_TOOL" in
  auto|oasdiff|builtin) ;;
  *)
    echo "✗ Invalid CONTRACT_DIFF_TOOL: $DIFF_TOOL (expected auto, oasdiff, or builtin)" >&2
    exit 2
    ;;
esac

resolve_diff_backend() {
  case "$DIFF_TOOL" in
    builtin)
      if command -v node >/dev/null 2>&1 && [[ -f "$ROOT/scripts/openapi-diff-fallback.mjs" ]]; then
        echo "builtin"
        return 0
      fi
      ;;
    oasdiff)
      if command -v oasdiff >/dev/null 2>&1; then
        echo "oasdiff"
        return 0
      fi
      if command -v docker >/dev/null 2>&1; then
        echo "docker"
        return 0
      fi
      ;;
    auto)
      if command -v oasdiff >/dev/null 2>&1; then
        echo "oasdiff"
        return 0
      fi
      if command -v docker >/dev/null 2>&1; then
        echo "docker"
        return 0
      fi
      if command -v node >/dev/null 2>&1 && [[ -f "$ROOT/scripts/openapi-diff-fallback.mjs" ]]; then
        echo "builtin"
        return 0
      fi
      ;;
  esac
  echo ""
}

has_diff_tool() {
  [[ -n "$(resolve_diff_backend)" ]]
}

run_diff_tool() {
  local backend
  backend="$(resolve_diff_backend)"
  case "$backend" in
    oasdiff)
      oasdiff "$@"
      return $?
      ;;
    docker)
      docker run --rm -v "$ROOT:/work" -v "/tmp:/tmp" -w /work tufin/oasdiff "$@"
      return $?
      ;;
    builtin)
      node "$ROOT/scripts/openapi-diff-fallback.mjs" "$@"
      return $?
      ;;
    *)
      if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
        echo "✗ No OpenAPI diff backend available for CONTRACT_DIFF_TOOL=$DIFF_TOOL (CHECK_STRICT=1)" >&2
        return 2
      fi
      echo "⚠ OpenAPI diff skipped: oasdiff/Docker unavailable and builtin fallback missing."
      return 0
      ;;
  esac
}

snapshot_manifest() {
  local out_file="$1"
  : > "$out_file"
  local existing_targets=()
  if [[ -f "$SPEC_REL" ]]; then existing_targets+=("$SPEC_REL"); fi
  if [[ -d "$WEB_GEN_REL" ]]; then existing_targets+=("$WEB_GEN_REL"); fi
  if [[ -d "$KMP_GEN_REL" ]]; then existing_targets+=("$KMP_GEN_REL"); fi

  if [[ ${#existing_targets[@]} -eq 0 ]]; then
    return 0
  fi

  find "${existing_targets[@]}" -type f 2>/dev/null \
    | LC_ALL=C sort \
    | while IFS= read -r file_path; do
        shasum -a 256 "$file_path" >> "$out_file"
      done
}

cmd_sync() {
  echo "━━ [contract:sync] 1/3 Exporting OpenAPI 3.1 spec from Spring Boot 4 (apps/pulse/backend)"
  (cd "$ROOT/apps/pulse/backend" && ./gradlew exportOpenApiSpec --no-daemon --stacktrace)

  echo "━━ [contract:sync] 2/3 Generating Angular 21 TypeScript types (apps/pulse/web)"
  (cd "$ROOT/apps/pulse/web" && npm run api:generate)

  echo "━━ [contract:sync] 3/3 Generating KMP multiplatform models (apps/pulse/kmp)"
  (cd "$ROOT/apps/pulse/kmp" && ./gradlew syncPulseApiModels --no-daemon --stacktrace)

  echo "✓ Contract sync complete:"
  echo "  - $SPEC_REL"
  echo "  - $WEB_GEN_REL/pulse-api.types.ts"
  echo "  - $KMP_GEN_REL/*.kt"
}

cmd_check() {
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  local before_manifest="$tmp_dir/before.sha256"
  local after_manifest="$tmp_dir/after.sha256"

  snapshot_manifest "$before_manifest"
  cmd_sync
  snapshot_manifest "$after_manifest"

  if ! diff -u "$before_manifest" "$after_manifest"; then
    echo "" >&2
    echo "✗ Contract drift detected! Generated artifacts changed during 'sync'." >&2
    echo "  Commit the updated files produced by 'bash scripts/api-contract.sh sync'." >&2
    exit 1
  fi

  if [[ "${GITHUB_ACTIONS:-false}" == "true" ]]; then
    if ! git diff --exit-code -- "$SPEC_REL" "$WEB_GEN_REL" "$KMP_GEN_REL"; then
      echo "✗ Uncommitted contract changes detected in CI." >&2
      exit 1
    fi
    if [[ -n "$(git status --porcelain -- "$SPEC_REL" "$WEB_GEN_REL" "$KMP_GEN_REL")" ]]; then
      echo "✗ Untracked contract files detected in CI." >&2
      exit 1
    fi
  fi

  echo "✓ Contract sync check passed (OpenAPI 3.1 spec, Angular TS types, and KMP models are 100% in sync)."
}

resolve_base_spec() {
  local requested_base="$1"
  local tmp_dir="$2"

  if [[ -n "$requested_base" && -f "$requested_base" ]]; then
    echo "$requested_base"
    return 0
  fi

  local base_ref="$requested_base"
  if [[ -z "$base_ref" ]]; then
    if git rev-parse --verify -q origin/main >/dev/null 2>&1; then
      base_ref="origin/main"
    elif git rev-parse --verify -q main >/dev/null 2>&1; then
      base_ref="main"
    else
      base_ref="HEAD"
    fi
  fi

  if git cat-file -e "${base_ref}:${SPEC_REL}" >/dev/null 2>&1; then
    local extracted="$tmp_dir/base.openapi.json"
    git show "${base_ref}:${SPEC_REL}" > "$extracted"
    echo "$extracted"
    return 0
  fi

  echo ""
  return 0
}

cmd_diff_op() {
  local op="$1"
  shift

  local base_arg=""
  local revision_arg="$SPEC_REL"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --base) shift; base_arg="${1:?--base requires a git ref or file path}" ;;
      --revision) shift; revision_arg="${1:?--revision requires a file path}" ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    esac
    shift
  done

  if [[ ! -f "$revision_arg" ]]; then
    echo "✗ Revision OpenAPI spec not found: $revision_arg" >&2
    exit 1
  fi

  if ! has_diff_tool; then
    if [[ "${CHECK_STRICT:-0}" == "1" ]]; then
      echo "✗ No OpenAPI diff tool available for CONTRACT_DIFF_TOOL=$DIFF_TOOL (CHECK_STRICT=1)" >&2
      exit 1
    fi
    echo "⚠ [contract:$op] skipped: no OpenAPI diff tool available"
    exit 0
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  local base_file
  base_file="$(resolve_base_spec "$base_arg" "$tmp_dir")"

  if [[ -z "$base_file" ]]; then
    echo "ℹ Base ref does not yet contain $SPEC_REL (initial contract introduction). Validating revision spec self-consistency..."
    base_file="$revision_arg"
  fi

  local backend
  backend="$(resolve_diff_backend)"
  case "$op" in
    breaking)
      echo "━━ [contract:breaking] ($backend) breaking --fail-on ERR $base_file $revision_arg"
      run_diff_tool breaking --fail-on ERR "$base_file" "$revision_arg"
      echo "✓ No OpenAPI breaking changes detected."
      ;;
    changelog)
      echo "━━ [contract:changelog] ($backend) changelog $base_file $revision_arg"
      run_diff_tool changelog "$base_file" "$revision_arg"
      ;;
  esac
}

cmd_drill() {
  require_cmd node
  if [[ ! -f "$SPEC_REL" ]]; then
    echo "✗ $SPEC_REL not found. Run 'bash scripts/api-contract.sh sync' first." >&2
    exit 1
  fi
  if ! has_diff_tool; then
    echo "✗ An OpenAPI diff tool (oasdiff, Docker, or builtin Node fallback) is required for the breaking-change drill." >&2
    exit 1
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  local base_copy="$tmp_dir/base.openapi.json"
  local expand_copy="$tmp_dir/expand-safe.openapi.json"
  local break_copy="$tmp_dir/breaking-change.openapi.json"

  cp "$SPEC_REL" "$base_copy"

  node -e '
    const fs = require("fs");
    const spec = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const expand = structuredClone(spec);
    expand.components.schemas.PulseDashboardResponse.properties.focusScore = {
      type: ["integer", "null"],
      format: "int32",
      description: "Optional additive score added during Expand phase."
    };
    fs.writeFileSync(process.argv[2], JSON.stringify(expand, null, 2));

    const broken = structuredClone(spec);
    delete broken.components.schemas.PulseDashboardResponse.properties.statusBanner;
    broken.components.schemas.PulseDashboardResponse.required =
      broken.components.schemas.PulseDashboardResponse.required.filter((f) => f !== "statusBanner");
    broken.components.schemas.TriageActionCode.enum =
      broken.components.schemas.TriageActionCode.enum.filter((v) => v !== "SHRINK_TO_5M");
    fs.writeFileSync(process.argv[3], JSON.stringify(broken, null, 2));
  ' "$base_copy" "$expand_copy" "$break_copy"

  local backend
  backend="$(resolve_diff_backend)"
  echo "━━ [Drill A: Safe Expand ($backend)] Adding optional nullable field 'focusScore' to PulseDashboardResponse"
  run_diff_tool breaking --fail-on ERR "$base_copy" "$expand_copy"
  run_diff_tool changelog "$base_copy" "$expand_copy"
  echo "✓ Drill A PASSED: safe additive Expand change permitted (exit 0)."
  echo ""

  echo "━━ [Drill B: Breaking Catch ($backend)] Removing required 'statusBanner' & enum value 'SHRINK_TO_5M'"
  set +e
  local break_output
  break_output="$(run_diff_tool breaking --fail-on ERR "$base_copy" "$break_copy" 2>&1)"
  local break_status=$?
  set -e

  if [[ $break_status -eq 0 ]]; then
    echo "✗ Drill B FAILED: $backend exited 0 instead of catching the breaking changes!" >&2
    exit 1
  fi

  echo "$break_output"
  echo "✓ Drill B PASSED: $backend caught breaking API changes (exit $break_status)."
}

SUBCMD="${1:-}"
if [[ -z "$SUBCMD" ]]; then
  usage >&2
  exit 2
fi
shift

case "$SUBCMD" in
  sync) cmd_sync "$@" ;;
  check) cmd_check "$@" ;;
  breaking) cmd_diff_op breaking "$@" ;;
  changelog) cmd_diff_op changelog "$@" ;;
  drill) cmd_drill "$@" ;;
  -h|--help) usage; exit 0 ;;
  *) echo "Unknown subcommand: $SUBCMD" >&2; usage >&2; exit 2 ;;
esac
