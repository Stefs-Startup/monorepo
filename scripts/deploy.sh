#!/usr/bin/env bash
# =============================================================================
# scripts/deploy.sh — Single-command production deployment to Google Cloud Run
# driven by infra/deploy/services.json (RFC-0002 / ADR-0004).
#
# Safety flow:
#   1. Idempotent GCP bootstrap (enable Run/ArtifactRegistry/CloudBuild APIs + repo)
#   2. Multi-surface linux/amd64 container build (Cloud Build or buildx) -> digest
#   3. Wire live cross-surface dependencies (e.g. pulse-web -> pulse-backend URL)
#   4. On existing services: deploy --no-traffic --tag=canary, run smoke-test.sh
#      against the canary URL, and promote 100% traffic ONLY if smoke passes.
#
# Compatibility: macOS /bin/bash 3.2+ and Linux bash (no associative arrays,
# no mapfile, no jq dependency — uses Node.js + gcloud + curl).
#
# Usage:
#   scripts/deploy.sh --surface all
#   scripts/deploy.sh --surface pulse-backend [--canary-percent 10]
#   scripts/deploy.sh --surface pulse-backend --image <uri> --drill-unhealthy-readiness
#
# Options:
#   --surface <name|all>            pulse-backend|pulse-web|gov-org-chart|all (default: all)
#   --project <gcp-project>         Override GCP project (default from services.json)
#   --region <gcp-region>           Override Cloud Run region (default from services.json)
#   --repo <artifact-repo>          Override Artifact Registry repo (default from services.json)
#   --env <staging|prod>            APP_ENV value injected into containers (default: prod)
#   --build-mode <cloudbuild|buildx> Image build strategy (default: cloudbuild)
#   --image <existing-image-uri>    Skip build & deploy existing image (single surface only)
#   --app-version <ver>             Override APP_VERSION env var
#   --canary-percent <1-100>        Traffic % to shift after canary smoke passes (default: 100)
#   --preview-tag <tag>             Deploy zero-traffic preview revision under tag (no prod shift)
#   --drill-unhealthy-readiness     Inject 503 readiness drill knob on canary (single surface only)
#   --retries <N>                   Smoke-test retry attempts (default: 8; 2 in drill mode)
#   --delay <sec>                   Seconds between smoke retries (default: 3)
#   --timeout <sec>                 Per-request curl timeout in seconds (default: 15)
#   --skip-bootstrap                Skip gcloud services enable & repo checks
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/infra/deploy/services.json"

SURFACE="all"
PROJECT=""
REGION=""
REPO=""
DEPLOY_ENV="prod"
BUILD_MODE="cloudbuild"
EXISTING_IMAGE=""
APP_VERSION_OVERRIDE=""
CANARY_PERCENT="100"
PREVIEW_TAG=""
DRILL_UNHEALTHY="0"
RETRIES=""
DELAY="3"
TIMEOUT="15"
SKIP_BOOTSTRAP="0"

usage() {
  sed -n '2,36p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --surface)
      shift
      SURFACE="${1:?--surface requires a value}"
      ;;
    --project)
      shift
      PROJECT="${1:?--project requires a value}"
      ;;
    --region)
      shift
      REGION="${1:?--region requires a value}"
      ;;
    --repo)
      shift
      REPO="${1:?--repo requires a value}"
      ;;
    --env)
      shift
      DEPLOY_ENV="${1:?--env requires a value}"
      ;;
    --build-mode)
      shift
      BUILD_MODE="${1:?--build-mode requires a value}"
      ;;
    --image)
      shift
      EXISTING_IMAGE="${1:?--image requires a value}"
      ;;
    --app-version)
      shift
      APP_VERSION_OVERRIDE="${1:?--app-version requires a value}"
      ;;
    --canary-percent)
      shift
      CANARY_PERCENT="${1:?--canary-percent requires a value}"
      ;;
    --preview-tag)
      shift
      PREVIEW_TAG="${1:?--preview-tag requires a value}"
      ;;
    --drill-unhealthy-readiness)
      DRILL_UNHEALTHY="1"
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
    --skip-bootstrap)
      SKIP_BOOTSTRAP="1"
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

command -v gcloud >/dev/null 2>&1 || { echo "Error: gcloud CLI is required" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "Error: node is required to parse $MANIFEST" >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required" >&2; exit 2; }
[ -f "$MANIFEST" ] || { echo "Error: manifest not found at $MANIFEST" >&2; exit 2; }

if [ "$BUILD_MODE" != "cloudbuild" ] && [ "$BUILD_MODE" != "buildx" ]; then
  echo "Error: --build-mode must be 'cloudbuild' or 'buildx' (got '$BUILD_MODE')" >&2
  exit 2
fi

case "$CANARY_PERCENT" in
  ''|*[!0-9]*)
    echo "Error: --canary-percent must be an integer 1..100 (got '$CANARY_PERCENT')" >&2
    exit 2
    ;;
esac
if [ "$CANARY_PERCENT" -lt 1 ] || [ "$CANARY_PERCENT" -gt 100 ]; then
  echo "Error: --canary-percent must be between 1 and 100 (got '$CANARY_PERCENT')" >&2
  exit 2
fi

if [ "$SURFACE" = "all" ] && [ -n "$EXISTING_IMAGE" ]; then
  echo "Error: --image cannot be combined with --surface all" >&2
  exit 2
fi

if [ "$SURFACE" = "all" ] && [ "$DRILL_UNHEALTHY" = "1" ]; then
  echo "Error: --drill-unhealthy-readiness requires a single --surface" >&2
  exit 2
fi

if [ -z "$RETRIES" ]; then
  if [ "$DRILL_UNHEALTHY" = "1" ]; then
    RETRIES="2"
  else
    RETRIES="8"
  fi
fi

read_manifest() {
  node -e '
    const fs = require("node:fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const key = process.argv[2];
    const svcName = process.argv[3] || "";
    if (key.startsWith("default.")) {
      const k = key.slice("default.".length);
      process.stdout.write(String((m.cloudRunDefaults && m.cloudRunDefaults[k]) ?? ""));
      process.exit(0);
    }
    if (key === "all_surfaces") {
      process.stdout.write(m.surfaces.map((s) => s.name).join(" "));
      process.exit(0);
    }
    const svc = m.surfaces.find((s) => s.name === svcName);
    if (!svc) {
      process.exit(1);
    }
    if (key.startsWith("cloudRun.")) {
      const k = key.slice("cloudRun.".length);
      const val = svc.cloudRun ? svc.cloudRun[k] : undefined;
      process.stdout.write(val === undefined || val === null ? "" : String(val));
      process.exit(0);
    }
    const val = svc[key];
    process.stdout.write(val === undefined || val === null ? "" : String(val));
  ' "$MANIFEST" "$1" "${2:-}"
}

PROJECT="${PROJECT:-$(read_manifest default.project)}"
REGION="${REGION:-$(read_manifest default.region)}"
REPO="${REPO:-$(read_manifest default.artifactRepo)}"

[ -n "$PROJECT" ] && [ -n "$REGION" ] && [ -n "$REPO" ] || {
  echo "Error: GCP project, region, and artifactRepo must be configured" >&2
  exit 2
}

if [ "$SURFACE" = "all" ]; then
  TARGET_SURFACES="$(read_manifest all_surfaces)"
else
  if ! read_manifest name "$SURFACE" >/dev/null 2>&1; then
    echo "Error: unknown surface '$SURFACE' in $MANIFEST" >&2
    exit 2
  fi
  TARGET_SURFACES="$SURFACE"
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' --quiet 2>/dev/null | head -n 1 || true)"
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "Error: no active gcloud auth account. Run 'gcloud auth login' first." >&2
  exit 1
fi

echo "======================================================================"
echo "RFC-0002 Cloud Run Deploy"
echo "  Project : $PROJECT (account: $ACTIVE_ACCOUNT)"
echo "  Region  : $REGION | Artifact Repo: $REPO"
echo "  Surfaces: $TARGET_SURFACES | Env: $DEPLOY_ENV | Build: $BUILD_MODE"
echo "======================================================================"

bootstrap_gcp() {
  echo "--- [Bootstrap] Checking GCP APIs & Artifact Registry ---"
  local enabled_apis
  enabled_apis="$(gcloud services list --enabled --project="$PROJECT" --format='value(config.name)' --quiet)"

  local missing_apis=""
  local api
  for api in run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com; do
    if ! printf '%s\n' "$enabled_apis" | grep -Fxq "$api"; then
      missing_apis="$missing_apis $api"
    fi
  done

  if [ -n "$missing_apis" ]; then
    echo "Enabling required GCP APIs:$missing_apis ..."
    # Word splitting is intentional across API names.
    # shellcheck disable=SC2086
    gcloud services enable $missing_apis --project="$PROJECT" --quiet
    echo "Waiting 10s for newly enabled GCP APIs to propagate..."
    sleep 10
  else
    echo "Required GCP APIs already enabled."
  fi

  local repo_attempt=1
  local repo_ready=0
  while [ "$repo_attempt" -le 6 ]; do
    if gcloud artifacts repositories describe "$REPO" --location="$REGION" --project="$PROJECT" --quiet >/dev/null 2>&1; then
      echo "Artifact Registry repository '$REPO' ready."
      repo_ready=1
      break
    fi
    echo "Creating Artifact Registry Docker repository '$REPO' in '$REGION' (attempt $repo_attempt/6)..."
    if gcloud artifacts repositories create "$REPO" \
      --repository-format=docker \
      --location="$REGION" \
      --description="CMP Monorepo Cloud Run images (RFC-0002)" \
      --project="$PROJECT" \
      --quiet; then
      repo_ready=1
      break
    fi
    if [ "$repo_attempt" -lt 6 ]; then
      echo "Waiting 10s for Artifact Registry API propagation before retrying..."
      sleep 10
    fi
    repo_attempt=$((repo_attempt + 1))
  done

  if [ "$repo_ready" -ne 1 ]; then
    echo "Error: failed to verify or create Artifact Registry repository '$REPO' in $PROJECT/$REGION." >&2
    exit 1
  fi
}

if [ "$SKIP_BOOTSTRAP" != "1" ]; then
  bootstrap_gcp
fi

GIT_SHA="$(git -C "$ROOT" rev-parse --short=7 HEAD 2>/dev/null || echo "nogit")"
GIT_SHA="$(printf '%s' "$GIT_SHA" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
[ -n "$GIT_SHA" ] || GIT_SHA="nogit"

SUMMARY_LINES=""
TEMP_ENV_FILES=""
cleanup_temps() {
  local f
  for f in $TEMP_ENV_FILES; do
    rm -f "$f"
  done
}
trap cleanup_temps EXIT

deploy_surface() {
  local svc="$1"
  local rel_path cr_service memory cpu cpu_boost min_inst max_inst concurrency timeout_sec allow_unauth upstream_svc drill_var
  rel_path="$(read_manifest path "$svc")"
  cr_service="$(read_manifest cloudRunService "$svc")"
  memory="$(read_manifest cloudRun.memory "$svc")"
  cpu="$(read_manifest cloudRun.cpu "$svc")"
  cpu_boost="$(read_manifest cloudRun.cpuBoost "$svc")"
  min_inst="$(read_manifest cloudRun.minInstances "$svc")"
  max_inst="$(read_manifest cloudRun.maxInstances "$svc")"
  concurrency="$(read_manifest cloudRun.concurrency "$svc")"
  timeout_sec="$(read_manifest cloudRun.timeoutSeconds "$svc")"
  allow_unauth="$(read_manifest cloudRun.allowUnauthenticated "$svc")"
  upstream_svc="$(read_manifest cloudRun.upstreamSurface "$svc")"
  drill_var="$(read_manifest drillEnvVar "$svc")"

  local surface_dir="$ROOT/$rel_path"
  [ -f "$surface_dir/Dockerfile" ] || { echo "Error: missing Dockerfile at $surface_dir/Dockerfile" >&2; exit 1; }

  local stamp rev_suffix image_uri deploy_image
  stamp="$(date -u +%Y%m%d%H%M%S)"
  rev_suffix="r${stamp}-${GIT_SHA}"

  if [ -n "$EXISTING_IMAGE" ]; then
    deploy_image="$EXISTING_IMAGE"
    echo ""
    echo "=== [$svc] Reusing immutable image: $deploy_image ==="
  else
    image_uri="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${svc}:${GIT_SHA}-${stamp}"
    echo ""
    echo "=== [$svc] Building linux/amd64 image ($BUILD_MODE): $image_uri ==="
    if [ "$BUILD_MODE" = "cloudbuild" ]; then
      local ignore_flag=""
      if [ -f "$surface_dir/.dockerignore" ]; then
        ignore_flag="--ignore-file=$surface_dir/.dockerignore"
      fi
      # shellcheck disable=SC2086
      gcloud builds submit "$surface_dir" --tag "$image_uri" $ignore_flag --project="$PROJECT" --quiet
    else
      gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
      docker buildx build --platform linux/amd64 --push -t "$image_uri" "$surface_dir"
    fi

    local digest_ref
    digest_ref="$(gcloud artifacts docker images describe "$image_uri" --project="$PROJECT" --format='value(image_summary.fully_qualified_digest)' --quiet 2>/dev/null || true)"
    if [ -n "$digest_ref" ]; then
      deploy_image="$digest_ref"
    else
      deploy_image="$image_uri"
    fi
    echo "Pinned image: $deploy_image"
  fi

  # Write YAML env-vars file (immune to comma escaping issues in CORS_ALLOWED_ORIGINS).
  local env_file
  env_file="$(mktemp /tmp/cmp-cr-env-XXXXXX)"
  TEMP_ENV_FILES="$TEMP_ENV_FILES $env_file"

  {
    printf 'APP_ENV: "%s"\n' "$DEPLOY_ENV"
    if [ -n "$APP_VERSION_OVERRIDE" ]; then
      printf 'APP_VERSION: "%s"\n' "$APP_VERSION_OVERRIDE"
    fi

    if [ "$svc" = "pulse-backend" ]; then
      printf 'CORS_ALLOWED_ORIGINS: "https://*.run.app,http://localhost:*,http://127.0.0.1:*"\n'
      if [ "$DRILL_UNHEALTHY" = "1" ]; then
        printf '%s: "true"\n' "$drill_var"
      else
        printf '%s: "false"\n' "$drill_var"
      fi
    elif [ "$svc" = "pulse-web" ]; then
      local upstream_cr_service upstream_url
      upstream_cr_service="$(read_manifest cloudRunService "$upstream_svc")"
      upstream_url="$(gcloud run services describe "$upstream_cr_service" --region="$REGION" --project="$PROJECT" --format='value(status.url)' --quiet 2>/dev/null || true)"
      if [ -z "$upstream_url" ]; then
        echo "Error: upstream service '$upstream_cr_service' is not deployed in $PROJECT/$REGION. Deploy $upstream_svc first." >&2
        exit 1
      fi
      printf 'API_UPSTREAM_URL: "%s"\n' "$upstream_url"
      if [ "$DRILL_UNHEALTHY" = "1" ]; then
        printf '%s: "true"\n' "$drill_var"
      else
        printf '%s: "false"\n' "$drill_var"
      fi
    elif [ "$svc" = "gov-org-chart" ]; then
      printf 'NODE_ENV: "production"\n'
      printf 'GOV_DB_PATH: "/tmp/gov-data/gov.sqlite"\n'
      if [ "$DRILL_UNHEALTHY" = "1" ]; then
        printf '%s: "true"\n' "$drill_var"
      else
        printf '%s: "false"\n' "$drill_var"
      fi
    fi
  } > "$env_file"

  local existing_json
  existing_json="$(gcloud run services describe "$cr_service" --region="$REGION" --project="$PROJECT" --format=json --quiet 2>/dev/null || true)"

  local extra_flags=""
  if [ "$cpu_boost" = "true" ]; then
    extra_flags="$extra_flags --cpu-boost"
  else
    extra_flags="$extra_flags --no-cpu-boost"
  fi
  if [ "$allow_unauth" = "true" ]; then
    extra_flags="$extra_flags --allow-unauthenticated"
  else
    extra_flags="$extra_flags --no-allow-unauthenticated"
  fi

  if [ -z "$existing_json" ]; then
    if [ "$DRILL_UNHEALTHY" = "1" ]; then
      echo "Error: --drill-unhealthy-readiness requires an existing healthy Cloud Run service '$cr_service'." >&2
      exit 1
    fi

    echo "=== [$svc] Creating brand-new Cloud Run service '$cr_service' ==="
    # shellcheck disable=SC2086
    gcloud run deploy "$cr_service" \
      --image="$deploy_image" \
      --region="$REGION" \
      --project="$PROJECT" \
      --platform=managed \
      --port=8080 \
      --memory="$memory" \
      --cpu="$cpu" \
      --min-instances="$min_inst" \
      --max-instances="$max_inst" \
      --concurrency="$concurrency" \
      --timeout="${timeout_sec}s" \
      --revision-suffix="$rev_suffix" \
      --env-vars-file="$env_file" \
      $extra_flags \
      --quiet

    local svc_json prod_url new_rev
    svc_json="$(gcloud run services describe "$cr_service" --region="$REGION" --project="$PROJECT" --format=json --quiet)"
    prod_url="$(node -e 'const s = JSON.parse(process.argv[1]); process.stdout.write(s.status?.url ?? "");' "$svc_json")"
    new_rev="$(node -e 'const s = JSON.parse(process.argv[1]); process.stdout.write(s.status?.latestReadyRevisionName || s.status?.latestCreatedRevisionName || "");' "$svc_json")"

    echo "=== [$svc] Running post-create smoke check against $prod_url (revision: $new_rev) ==="
    /bin/bash "$ROOT/scripts/smoke-test.sh" \
      --surface "$svc" \
      --url "$prod_url" \
      --expect-revision "$new_rev" \
      --retries "$RETRIES" \
      --delay "$DELAY" \
      --timeout "$TIMEOUT"

    SUMMARY_LINES="${SUMMARY_LINES}${svc}|${new_rev}|${prod_url}|${deploy_image}\n"
  else
    local prev_rev prod_url
    prod_url="$(node -e 'const s = JSON.parse(process.argv[1]); process.stdout.write(s.status?.url ?? "");' "$existing_json")"
    prev_rev="$(node -e '
      const s = JSON.parse(process.argv[1]);
      const traffic = (s.status?.traffic ?? []).filter((t) => (t.percent ?? 0) > 0 && t.revisionName);
      traffic.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
      process.stdout.write(traffic[0]?.revisionName ?? (s.status?.latestReadyRevisionName ?? ""));
    ' "$existing_json")"

    local deploy_tag="canary"
    if [ -n "$PREVIEW_TAG" ]; then
      deploy_tag="$PREVIEW_TAG"
      echo "=== [$svc] Deploying zero-traffic PR preview revision under tag '$deploy_tag' (prod stays on $prev_rev) ==="
    else
      echo "=== [$svc] Deploying zero-traffic canary revision (current live: $prev_rev) ==="
    fi
    # shellcheck disable=SC2086
    gcloud run deploy "$cr_service" \
      --image="$deploy_image" \
      --region="$REGION" \
      --project="$PROJECT" \
      --platform=managed \
      --port=8080 \
      --memory="$memory" \
      --cpu="$cpu" \
      --min-instances="$min_inst" \
      --max-instances="$max_inst" \
      --concurrency="$concurrency" \
      --timeout="${timeout_sec}s" \
      --revision-suffix="$rev_suffix" \
      --env-vars-file="$env_file" \
      --no-traffic \
      --tag="$deploy_tag" \
      $extra_flags \
      --quiet

    local svc_json new_rev canary_url
    svc_json="$(gcloud run services describe "$cr_service" --region="$REGION" --project="$PROJECT" --format=json --quiet)"
    new_rev="$(node -e 'const s = JSON.parse(process.argv[1]); process.stdout.write(s.status?.latestCreatedRevisionName ?? "");' "$svc_json")"
    canary_url="$(node -e '
      const s = JSON.parse(process.argv[1]);
      const tag = process.argv[2];
      const entry = (s.status?.traffic ?? []).find((t) => t.tag === tag);
      process.stdout.write(entry?.url ?? "");
    ' "$svc_json" "$deploy_tag")"

    if [ -z "$canary_url" ] || [ -z "$new_rev" ]; then
      echo "Error: could not resolve tagged URL or revision for '$cr_service' (tag=$deploy_tag, new_rev=$new_rev, url=$canary_url)" >&2
      exit 1
    fi

    echo "=== [$svc] Smoke-testing tagged revision $canary_url (revision: $new_rev) ==="
    if ! /bin/bash "$ROOT/scripts/smoke-test.sh" \
      --surface "$svc" \
      --url "$canary_url" \
      --expect-revision "$new_rev" \
      --retries "$RETRIES" \
      --delay "$DELAY" \
      --timeout "$TIMEOUT"; then
      echo "" >&2
      echo "CANARY SMOKE GATE BLOCKED PROMOTION for '$cr_service':" >&2
      echo "  Failed Revision        : $new_rev ($canary_url)" >&2
      echo "  Production Traffic Safe: 100% still on $prev_rev ($prod_url)" >&2
      echo "  Recent Logs Hint       : gcloud run services logs read $cr_service --region=$REGION --project=$PROJECT --limit=20" >&2
      exit 1
    fi

    if [ -n "$PREVIEW_TAG" ]; then
      echo "=== [$svc] Preview ready at $canary_url (production traffic untouched on $prev_rev) ==="
      if [ -n "${GITHUB_OUTPUT:-}" ]; then
        {
          echo "preview_url=$canary_url"
          echo "preview_revision=$new_rev"
        } >> "$GITHUB_OUTPUT"
      fi
      SUMMARY_LINES="${SUMMARY_LINES}${svc}|${new_rev}|${canary_url}|${deploy_image}\n"
      return 0
    fi

    if [ "$CANARY_PERCENT" -lt 100 ] && [ -n "$prev_rev" ] && [ "$prev_rev" != "$new_rev" ]; then
      local remain_pct=$((100 - CANARY_PERCENT))
      echo "=== [$svc] Shifting ${CANARY_PERCENT}% traffic to $new_rev (${remain_pct}% stays on $prev_rev) ==="
      gcloud run services update-traffic "$cr_service" \
        --region="$REGION" \
        --project="$PROJECT" \
        --to-revisions="${new_rev}=${CANARY_PERCENT},${prev_rev}=${remain_pct}" \
        --quiet
    else
      echo "=== [$svc] Promoting 100% production traffic to $new_rev ==="
      gcloud run services update-traffic "$cr_service" \
        --region="$REGION" \
        --project="$PROJECT" \
        --to-revisions="${new_rev}=100" \
        --quiet

      echo "=== [$svc] Post-promotion verification on $prod_url ==="
      /bin/bash "$ROOT/scripts/smoke-test.sh" \
        --surface "$svc" \
        --url "$prod_url" \
        --expect-revision "$new_rev" \
        --retries "$RETRIES" \
        --delay "$DELAY" \
        --timeout "$TIMEOUT"
    fi

    SUMMARY_LINES="${SUMMARY_LINES}${svc}|${new_rev}|${prod_url}|${deploy_image}\n"
  fi
}

for svc in $TARGET_SURFACES; do
  deploy_surface "$svc"
done

echo ""
echo "======================================================================"
echo "Deployment Summary ($PROJECT / $REGION / env=$DEPLOY_ENV)"
echo "======================================================================"
printf '%b' "$SUMMARY_LINES" | while IFS='|' read -r s_name s_rev s_url s_img; do
  [ -n "$s_name" ] || continue
  printf '  %-15s rev=%-32s url=%s\n' "$s_name" "$s_rev" "$s_url"
  printf '  %-15s image=%s\n' "" "$s_img"
done
