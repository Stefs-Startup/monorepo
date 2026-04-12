# ADR-0003: Local Development Infrastructure

**Status:** Accepted
**Date:** 2026-03-15
**Deciders:** Company of One

---

## Context

As the monorepo grows and we add more applications (such as the app template and future API layers), we need a consistent way to run local infrastructure dependencies like databases and caching layers. We need a solution that is easy to start, requires minimal configuration, and closely mirrors production environments.

## Decision

We will use **Docker Compose** to manage local infrastructure dependencies.

The configuration will be centralized in `infra/docker-compose.yml`. Initially, this includes:
- **PostgreSQL 15** for relational data.
- **Redis 7** for caching and session management.

## Rationale

- **Consistency**: Docker ensures that the infrastructure runs identically across different developer machines and CI environments.
- **Simplicity**: A single `docker-compose up` command is all that's needed to spin up the entire local infrastructure stack.
- **Isolation**: Services run in containers, avoiding conflicts with natively installed services on the host machine.
- **Alternatives Considered**:
  - *Native installations*: Rejected due to potential version conflicts and setup complexity across different operating systems.
  - *Managed cloud databases for local dev*: Rejected due to latency, potential costs, and the requirement for an active internet connection during development.

## Consequences

- Developers must have Docker and Docker Compose installed on their machines.
- The `infra/docker-compose.yml` file becomes the single source of truth for local infrastructure.
- We must ensure that environment variables used in apps (`.env` files) align with the ports and credentials defined in the Docker Compose configuration.