# ADR-0003: Docker Compose for Local Infrastructure

**Status:** Accepted
**Date:** 2026-03-15
**Deciders:** Company of One (CMP-12)

---

## Context

Local development requires stateful services (databases, caches). We need a reproducible way to run these services without requiring manual installation of binary packages on host machines (Mac or AlmaLinux).

## Decision

We will use **Docker Compose** (`infra/docker-compose.yml`) to orchestrate local infrastructure like PostgreSQL and Redis. Environment variables in the compose file must be parameterized with fallback values (e.g., `${POSTGRES_USER:-postgres}`) to prevent hardcoding secrets in the repository.

## Rationale

- **Reproducibility**: `docker compose up -d` guarantees the same versions and configuration for any developer (or agent) working on the repo.
- **Isolation**: Prevents conflicts with system-level installations.
- **Simplicity**: No need for Kubernetes (minikube, k3d) which adds cognitive overhead and resource usage for simple stateful services. Parameterized variables allow flexibility if needed, while defaults provide a zero-config experience out of the box.

## Consequences

- All developers must have Docker installed.
- Applications should connect to these services using the default exposed ports on `localhost` during local development.
- Environment configurations must use `.env` files or system environment variables to override the compose file defaults if necessary.
