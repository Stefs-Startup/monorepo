# ADR-0003: Docker Compose for Local Infrastructure

**Status:** Accepted
**Date:** 2026-03-15
**Deciders:** Company of One (CMP-12)

---

## Context

We need a standardized way to run local infrastructure dependencies such as databases (PostgreSQL) and caching layers (Redis) for local development across all apps in the monorepo.

## Decision

We will use **Docker Compose** with a `docker-compose.yml` file located in the `infra/` directory to manage local infrastructure.

## Rationale

- Provides a consistent local environment for all developers (and agents).
- Docker is industry standard and integrates well with other tools.
- Easy to start up and tear down.

## Consequences

- Requires Docker to be installed locally.
- Configuration for local services will be centrally managed in `infra/docker-compose.yml`.
