# ADR-0004: Single-Command Cloud Run Deploy & Instant Rollback

**Status:** Accepted  
**Date:** 2026-11-19  
**Deciders:** Stefan + Antigravity  

---

## Context

Prior to this decision (captured in RFC-0002), the monorepo enforced strict local and CI validation gates across Node/TypeScript, Spring Boot 4 / Java 21, Angular 21, and Kotlin Multiplatform, yet had zero live production HTTPS deployments and no verified rollback procedure.

Operating a self-managed Kubernetes cluster and Crossplane control plane (explored and parked in RFC-0001) introduces always-on cluster management and RAM/CPU overhead before our service count justifies it. At the same time, deploying multiple heterogeneous surfaces (`apps/pulse/backend` distroless JVM API, `apps/pulse/web` unprivileged Nginx edge proxy, and `apps/gov-org-chart` single-container Node 22 BFF) requires a consistent, repeatable rollout and rollback mechanism rather than ad-hoc console clicks.

## Decision

We standardize production HTTP deployments on **Google Cloud Run** (`us-central1`, project `gw-cli-490302`, scale-to-zero `min-instances=0`, `max-instances=2`), driven by one declarative manifest and three portable Bash 3.2-compatible scripts:

1. **Declarative Surface Contract ([`infra/deploy/services.json`](../../infra/deploy/services.json)):** Single source of truth for surface paths, container ports, liveness/readiness/info probe paths, smoke assertions, Cloud Run sizing, and upstream wiring (`pulse-web` → `pulse-backend`).
2. **Gated Single-Command Rollout ([`scripts/deploy.sh`](../../scripts/deploy.sh)):** Builds `linux/amd64` images pinned by immutable Artifact Registry digest, deploys updates at `0%` production traffic (`--no-traffic --tag=canary`), executes [`scripts/smoke-test.sh`](../../scripts/smoke-test.sh) against the isolated canary URL, and promotes `100%` (or `--canary-percent`) traffic **only** after liveness, readiness, revision identity, and functional smoke checks pass.
3. **Sub-10-Second Instant Rollback ([`scripts/rollback.sh`](../../scripts/rollback.sh)):** Shifts `100%` traffic back to a prior `Ready=True` healthy immutable revision (automatically skipping drill-flagged revisions) and immediately re-runs `scripts/smoke-test.sh` against the live production URL.
4. **OIDC-Authenticated CI Automation ([`.github/workflows/deploy-cloud-run.yml`](../../.github/workflows/deploy-cloud-run.yml)):** Reusable `workflow_dispatch` / `workflow_call` pipeline pinned strictly to 40-character commit SHAs, delegating to the exact same `deploy.sh` and `rollback.sh` scripts.

## Rationale

- **Zero-downtime safety before traffic shift:** `--no-traffic --tag=canary` prevents unhealthy revisions (verified live via `PULSE_SIMULATE_UNHEALTHY_READINESS=true` HTTP `503` readiness catch) from serving production requests.
- **Immutable revisions give fast, deterministic rollback:** Reverting traffic between existing immutable Cloud Run revisions avoids slow rebuilds and completed in `6s` during live verification.
- **Scale-to-zero economics:** `min-instances=0` keeps idle cost near zero while preserving instant traffic routing across revisions.
- **One workflow locally and in CI:** Both developers and GitHub Actions invoke the exact same Bash scripts, preventing CI-only drift.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **GKE + Argo CD + Crossplane (RFC-0001)** | Premature cluster and controller-pod operational overhead for 3 small stateless services. Revisit criteria remain in RFC-0001. |
| **Manual `gcloud run deploy` per service** | No unified smoke gate, no automatic `pulse-web` → `pulse-backend` URL wiring, and no automated rollback verification. |
| **GitHub Actions-only deploy YAML** | Hard to test or execute emergency rollbacks directly from a local terminal during an incident. |

## Consequences

- **Positive:** All 3 HTTP surfaces share a single deploy, smoke, and rollback contract; live canary blocking and `6s` rollback are verified against real HTTPS endpoints.
- **Trade-off (Platform Architecture):** Apple Silicon local Docker builds emit `linux/arm64` by default, so Cloud Run deploys build `linux/amd64` remotely via Cloud Build (with `docker buildx --platform linux/amd64` fallback).
- **Trade-off (Stateless First):** Services currently keep state ephemeral (`/tmp/gov-data/gov.sqlite` or in-memory demo data). Adding Cloud SQL / managed Postgres later will require expand-and-contract Flyway migrations (Phase 2) so simultaneous old/new revisions remain backward-compatible during rollbacks.
- **Trade-off (GFE Reserved Paths):** Cloud Run's Google Front End intercepts `/healthz` before reaching containers; web edge surfaces must use `/livez` (or `/api/health`) for external liveness probes.
