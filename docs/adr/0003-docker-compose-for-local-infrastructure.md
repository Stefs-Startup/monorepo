# ADR-0003: Docker Compose for Local Infrastructure

**Status:** Accepted
**Date:** 2024-04-20
**Deciders:** Company of One

---

## Context

We need a consistent way to run local infrastructure dependencies like PostgreSQL and Redis for development and testing. Setting these up manually is error-prone and tedious.

## Decision

We will use Docker Compose (`infra/docker-compose.yml`) to orchestrate local infrastructure dependencies.

## Rationale

Docker Compose provides a declarative, reproducible way to define and run multi-container applications. It is widely understood and integrates well with local development workflows. We configure it using parameterized environment variables (e.g., `${POSTGRES_USER:-postgres}`) to avoid hardcoding plaintext secrets while providing sensible defaults for local development.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Manual installation | Error-prone, hard to ensure identical setups across different machines. |
| Managed cloud services for local dev | Adds latency, requires internet access, incurs costs. |

## Consequences

- Developers must install Docker and Docker Compose.
- Starting the local environment will require running `docker-compose up` in addition to `pnpm dev`.
- Production deployments will require separate configuration, as this Compose file is explicitly for local development.
