#!/usr/bin/env bash
# =============================================================================
# scripts/smoke-test.sh — Cross-surface liveness, readiness, revision & HTTP
# smoke verification driven by infra/deploy/services.json.
#
# Compatibility: macOS /bin/bash 3.2+ and Linux bash (no associative arrays,
# no mapfile, no jq dependency — uses Node.js for JSON parsing + curl for HTTP).
#
# Usage:
#   scripts/smoke-test.sh --surface all-local [--expect-revision <rev>]
#   scripts/smoke-test.sh --surface pulse-backend [--url http://127.0.0.1:8080]
#   scripts/smoke-test.sh --surface pulse-web --url https://pulse-web-...run.app
#
# Options:
#   --surface <name|all-local>   Target surface from infra/deploy/services.json
#   --url <base-url>             Override base URL (single surface only)
#   --expect-revision <rev>      Assert info endpoint reports this revision
#   --retries <N>                Max attempts per probe check (default: 5)
#   --delay <sec>                Seconds between retries (default: 2)
#   --timeout <sec>              Per-request curl timeout in seconds (default: 5)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/infra/deploy/services.json"

SURFACE="all-local"
BASE_URL_OVERRIDE=""
EXPECT_REVISION=""
RETRIES=5
DELAY=2
TIMEOUT=5

usage() {
  sed -n '2,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --surface)
      shift
      SURFACE="${1:?--surface requires a value}"
      ;;
    --url)
      shift
      BASE_URL_OVERRIDE="${1:?--url requires a value}"
      ;;
    --expect-revision)
      shift
      EXPECT_REVISION="${1:?--expect-revision requires a value}"
      ;;
    --retries)
      shift
      RETRIES="${1:?--retries requires a value}"
      ;;
    --delay)
      shift
      DELAY="${1:?--delay requires a value}"
      ;;
    --timeout)
      shift
      TIMEOUT="${1:?--timeout requires a value}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

command -v node >/dev/null 2>&1 || { echo "Error: node is required to parse $MANIFEST" >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required for HTTP probes" >&2; exit 2; }
[ -f "$MANIFEST" ] || { echo "Error: manifest not found at $MANIFEST" >&2; exit 2; }

if [ "$SURFACE" = "all-local" ] && [ -n "$BASE_URL_OVERRIDE" ]; then
  echo "Error: --url cannot be combined with --surface all-local" >&2
  exit 2
fi

# Strip trailing slash from override URL if supplied.
BASE_URL_OVERRIDE="${BASE_URL_OVERRIDE%/}"

# Resolve surface list from manifest (Bash 3.2 safe word-split over known slug names).
if [ "$SURFACE" = "all-local" ]; then
  TARGET_SURFACES="$(node -e '
    const fs = require("node:fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(m.surfaces.map((s) => s.name).join(" "));
  ' "$MANIFEST")"
else
  EXISTS="$(node -e '
    const fs = require("node:fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const ok = m.surfaces.some((s) => s.name === process.argv[2]);
    process.stdout.write(ok ? "1" : "0");
  ' "$MANIFEST" "$SURFACE")"
  if [ "$EXISTS" != "1" ]; then
    echo "Error: unknown surface '$SURFACE' in $MANIFEST" >&2
    exit 2
  fi
  TARGET_SURFACES="$SURFACE"
fi

get_surface_field() {
  node -e '
    const fs = require("node:fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const s = m.surfaces.find((item) => item.name === process.argv[2]);
    const val = s ? s[process.argv[3]] : undefined;
    process.stdout.write(val === undefined || val === null ? "" : String(val));
  ' "$MANIFEST" "$1" "$2"
}

LAST_BODY=""
LAST_CODE=""

# Fetch URL with bounded retries until HTTP 200 (and optional substring match).
http_check_with_retry() {
  local label="$1"
  local url="$2"
  local expect_substr="${3:-}"
  local attempt=1
  local body_file
  body_file="$(mktemp)"

  while [ "$attempt" -le "$RETRIES" ]; do
    local code
    code="$(curl -sS -L -m "$TIMEOUT" -o "$body_file" -w '%{http_code}' "$url" 2>/dev/null || echo "000")"
    LAST_CODE="$code"
    LAST_BODY="$(cat "$body_file")"

    if [ "$code" = "200" ]; then
      if [ -z "$expect_substr" ] || printf '%s' "$LAST_BODY" | grep -Fq "$expect_substr"; then
        rm -f "$body_file"
        printf '  [PASS] %-14s %s (HTTP %s)\n' "$label" "$url" "$code"
        return 0
      fi
      LAST_CODE="200 (missing substring '$expect_substr')"
    fi

    if [ "$attempt" -lt "$RETRIES" ]; then
      sleep "$DELAY"
    fi
    attempt=$((attempt + 1))
  done

  rm -f "$body_file"
  printf '  [FAIL] %-14s %s (HTTP %s)\n' "$label" "$url" "$LAST_CODE" >&2
  if [ -n "$LAST_BODY" ]; then
    printf '         response: %.240s\n' "$LAST_BODY" >&2
  fi
  return 1
}

FAILURES=0

for svc in $TARGET_SURFACES; do
  local_port="$(get_surface_field "$svc" "localPort")"
  liveness_path="$(get_surface_field "$svc" "livenessPath")"
  readiness_path="$(get_surface_field "$svc" "readinessPath")"
  info_path="$(get_surface_field "$svc" "infoPath")"
  smoke_path="$(get_surface_field "$svc" "smokePath")"
  smoke_substr="$(get_surface_field "$svc" "smokeExpectSubstring")"
  html_path="$(get_surface_field "$svc" "htmlSmokePath")"
  html_substr="$(get_surface_field "$svc" "htmlExpectSubstring")"
  rev_json_path="$(get_surface_field "$svc" "revisionJsonPath")"

  if [ -n "$BASE_URL_OVERRIDE" ]; then
    base_url="$BASE_URL_OVERRIDE"
  else
    base_url="http://127.0.0.1:${local_port}"
  fi

  echo "=== Smoke verifying $svc ($base_url) ==="

  svc_ok=1
  http_check_with_retry "liveness" "${base_url}${liveness_path}" "" || svc_ok=0
  http_check_with_retry "readiness" "${base_url}${readiness_path}" "" || svc_ok=0

  if http_check_with_retry "info" "${base_url}${info_path}" ""; then
    actual_rev="$(node -e '
      try {
        const obj = JSON.parse(process.argv[1]);
        const keys = process.argv[2].split(".");
        let cur = obj;
        for (const k of keys) {
          cur = cur && typeof cur === "object" ? cur[k] : undefined;
        }
        process.stdout.write(cur === undefined || cur === null ? "" : String(cur));
      } catch {
        process.exit(1);
      }
    ' "$LAST_BODY" "$rev_json_path" 2>/dev/null || echo "__PARSE_ERR__")"

    if [ "$actual_rev" = "__PARSE_ERR__" ] || [ -z "$actual_rev" ]; then
      printf '  [FAIL] %-14s could not extract %s from %s\n' "revision" "$rev_json_path" "${base_url}${info_path}" >&2
      svc_ok=0
    elif [ -n "$EXPECT_REVISION" ] && [ "$actual_rev" != "$EXPECT_REVISION" ]; then
      printf '  [FAIL] %-14s expected revision "%s", got "%s"\n' "revision" "$EXPECT_REVISION" "$actual_rev" >&2
      svc_ok=0
    else
      printf '  [PASS] %-14s revision=%s (%s)\n' "revision" "$actual_rev" "$rev_json_path"
    fi
  else
    svc_ok=0
  fi

  http_check_with_retry "smoke-api" "${base_url}${smoke_path}" "$smoke_substr" || svc_ok=0

  if [ -n "$html_path" ]; then
    http_check_with_retry "smoke-html" "${base_url}${html_path}" "$html_substr" || svc_ok=0
  fi

  if [ "$svc_ok" -ne 1 ]; then
    FAILURES=$((FAILURES + 1))
  fi
done

if [ "$FAILURES" -gt 0 ]; then
  echo "Smoke verification FAILED ($FAILURES surface(s) failed)." >&2
  exit 1
fi

echo "Smoke verification PASSED for all target surfaces."
