# `infra/` — Deployment Manifest & Local Production Parity

Declarative deployment configuration for containerized HTTP services targeting Google Cloud Run and local Docker Compose parity.

## Key Files

| File | Purpose |
| :--- | :--- |
| [`deploy/services.json`](./deploy/services.json) | Canonical manifest defining deployable surfaces (`pulse-backend`, `pulse-web`), Cloud Run sizing, health probe paths, and dependency order |
| [`compose.prod-local.yml`](./compose.prod-local.yml) | Local multi-stage container stack (`pulse-backend` + `pulse-web` Nginx edge proxy) matching Cloud Run runtime behavior |

## Common Operations

- **Local production-parity stack:**
  ```bash
  docker compose -f infra/compose.prod-local.yml up --build
  ```
- **Deploy / Canary / Rollback (Cloud Run):**
  ```bash
  /bin/bash scripts/deploy.sh --surface all
  /bin/bash scripts/deploy.sh --surface pulse-backend --canary-percent 10
  /bin/bash scripts/rollback.sh --surface pulse-backend
  ```
- **CI/CD Automation:** `.github/workflows/deploy-cloud-run.yml` (triggered on `pulse-backend-v*` / `pulse-web-v*` tags or `workflow_dispatch`) and `.github/workflows/preview-pulse-web.yml` authenticate to GCP project `gw-cli-490302` (`us-central1`) using keyless OIDC Workload Identity Federation.

See [`docs/guides/01-single-command-prod-deploy-and-rollback-playbook.md`](../docs/guides/01-single-command-prod-deploy-and-rollback-playbook.md) for full operational details.
