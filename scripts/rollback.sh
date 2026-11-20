#!/usr/bin/env bash
# =============================================================================
# scripts/rollback.sh — Single-command instant Cloud Run traffic rollback
# driven by infra/deploy/services.json (RFC-0002 / ADR-0004).
#
# Shifts 100% traffic immediately back to a known-healthy previous immutable
# Cloud Run revision, measures rollback elapsed seconds, and runs
# scripts/smoke-test.sh against the live URL.
#
# Compatibility: macOS /bin/bash 3.2+ and Linux bash (no associative arrays,
# no mapfile, no jq dependency — uses Node.js + gcloud + curl).
#
# Usage:
#   scripts/rollback.sh --surface pulse-backend
#   scripts/rollback.sh --surface pulse-backend --to-revision pulse-backend-...
#
# Options:
#   --surface <name>          Required surface from infra/deploy/services.json
#   --to-revision <rev>       Explicit target revision (optional; auto-picks newest healthy prior rev)
#   --project <gcp-project>   Override GCP project (default from services.json)
#   --region <gcp-region>     Override Cloud Run region (default from services.json)
#   --retries <N>             Smoke-test retry attempts (default: 5)
#   --delay <sec>             Seconds between smoke retries (default: 2)
#   --timeout <sec>           Per-request curl timeout in seconds (default: 15)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/infra/deploy/services.json"

SURFACE=""
TO_REVISION=""
PROJECT=""
REGION=""
RETRIES="5"
DELAY="2"
TIMEOUT="15"

usage() {
  sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --surface)
      shift
      SURFACE="${1:?--surface requires a value}"
      ;;
    --to-revision)
      shift
      TO_REVISION="${1:?--to-revision requires a value}"
      ;;
    --project)
      shift
      PROJECT="${1:?--project requires a value}"
      ;;
    --region)
      shift
      REGION="${1:?--region requires a value}"
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

[ -n "$SURFACE" ] || { echo "Error: --surface is required" >&2; usage >&2; exit 2; }
command -v gcloud >/dev/null 2>&1 || { echo "Error: gcloud CLI is required" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "Error: node is required to parse $MANIFEST" >&2; exit 2; }
[ -f "$MANIFEST" ] || { echo "Error: manifest not found at $MANIFEST" >&2; exit 2; }

SURFACE_INFO="$(node -e '
  const fs = require("node:fs");
  const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const s = m.surfaces.find((item) => item.name === process.argv[2]);
  if (!s) process.exit(1);
  const project = process.argv[3] || m.cloudRunDefaults?.project || "";
  const region = process.argv[4] || m.cloudRunDefaults?.region || "";
  process.stdout.write([s.cloudRunService, project, region].join("|"));
' "$MANIFEST" "$SURFACE" "$PROJECT" "$REGION" 2>/dev/null || true)"

if [ -z "$SURFACE_INFO" ]; then
  echo "Error: unknown surface '$SURFACE' in $MANIFEST" >&2
  exit 2
fi

CR_SERVICE="$(printf '%s' "$SURFACE_INFO" | cut -d'|' -f1)"
PROJECT="$(printf '%s' "$SURFACE_INFO" | cut -d'|' -f2)"
REGION="$(printf '%s' "$SURFACE_INFO" | cut -d'|' -f3)"

[ -n "$PROJECT" ] && [ -n "$REGION" ] || { echo "Error: GCP project and region are required" >&2; exit 2; }

SVC_JSON="$(gcloud run services describe "$CR_SERVICE" --region="$REGION" --project="$PROJECT" --format=json --quiet 2>/dev/null || true)"
if [ -z "$SVC_JSON" ]; then
  echo "Error: Cloud Run service '$CR_SERVICE' not found in $PROJECT/$REGION" >&2
  exit 1
fi

PROD_URL="$(node -e 'const s = JSON.parse(process.argv[1]); process.stdout.write(s.status?.url ?? "");' "$SVC_JSON")"
CURRENT_REV="$(node -e '
  const s = JSON.parse(process.argv[1]);
  const traffic = (s.status?.traffic ?? []).filter((t) => (t.percent ?? 0) > 0 && t.revisionName);
  traffic.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  process.stdout.write(traffic[0]?.revisionName ?? (s.status?.latestReadyRevisionName ?? ""));
' "$SVC_JSON")"

REVS_JSON="$(gcloud run revisions list --service="$CR_SERVICE" --region="$REGION" --project="$PROJECT" --format=json --quiet)"

SELECTION="$(node -e '
  const revs = JSON.parse(process.argv[1]);
  const currentRev = process.argv[2];
  const explicitTarget = process.argv[3];

  const isReady = (r) =>
    (r.status?.conditions ?? []).some((c) => c.type === "Ready" && c.status === "True");
  const isDrillFlagged = (r) => {
    const containers = r.spec?.containers ?? [];
    for (const c of containers) {
      for (const e of (c.env ?? [])) {
        if (
          (e.name === "PULSE_SIMULATE_UNHEALTHY_READINESS" ||
            e.name === "GOV_SIMULATE_UNHEALTHY_READINESS") &&
          String(e.value).toLowerCase() === "true"
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const sorted = [...revs].sort((a, b) => {
    const ta = Date.parse(a.metadata?.creationTimestamp ?? 0) || 0;
    const tb = Date.parse(b.metadata?.creationTimestamp ?? 0) || 0;
    return tb - ta;
  });

  if (explicitTarget) {
    const found = sorted.find((r) => r.metadata?.name === explicitTarget);
    if (!found) {
      console.error(`Target revision "${explicitTarget}" not found.`);
      process.exit(1);
    }
    if (!isReady(found)) {
      console.error(`Target revision "${explicitTarget}" is not Ready=True.`);
      process.exit(1);
    }
    process.stdout.write(explicitTarget);
    process.exit(0);
  }

  const candidate = sorted.find(
    (r) =>
      r.metadata?.name &&
      r.metadata.name !== currentRev &&
      isReady(r) &&
      !isDrillFlagged(r)
  );
  if (!candidate) {
    console.error("No prior healthy Ready=True revision available to roll back to.");
    console.error("Available revisions:");
    for (const r of sorted) {
      console.error(
        `  - ${r.metadata?.name} (ready=${isReady(r)}, drill=${isDrillFlagged(r)}, created=${r.metadata?.creationTimestamp})`
      );
    }
    process.exit(1);
  }
  process.stdout.write(candidate.metadata.name);
' "$REVS_JSON" "$CURRENT_REV" "$TO_REVISION")"

TARGET_REV="$SELECTION"
echo "Rolling back '$CR_SERVICE' ($PROJECT/$REGION):"
echo "  From Revision: $CURRENT_REV"
echo "  To Revision  : $TARGET_REV"
echo "  Service URL  : $PROD_URL"

START_TS="$(date +%s)"
gcloud run services update-traffic "$CR_SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --to-revisions="${TARGET_REV}=100" \
  --quiet
END_TS="$(date +%s)"
ELAPSED=$((END_TS - START_TS))

echo "Traffic shifted from $CURRENT_REV -> $TARGET_REV in ${ELAPSED}s"

/bin/bash "$ROOT/scripts/smoke-test.sh" \
  --surface "$SURFACE" \
  --url "$PROD_URL" \
  --expect-revision "$TARGET_REV" \
  --retries "$RETRIES" \
  --delay "$DELAY" \
  --timeout "$TIMEOUT"

echo "Rollback PASSED and verified live at $PROD_URL ($TARGET_REV, ${ELAPSED}s)."
