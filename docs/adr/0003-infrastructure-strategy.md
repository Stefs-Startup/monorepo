# ADR-0003: Infrastructure Strategy

**Status:** Accepted
**Date:** 2026-04-19
**Deciders:** Company of One (CMP-13)

---

## Context

With the creation of the application template and shared packages, we need a consistent way to run local infrastructure dependencies like databases and caches.

## Decision

We will use Docker Compose (`infra/docker-compose.yml`) for local infrastructure orchestration.

## Rationale

Docker Compose provides a single, reproducible way to spin up the required local services without requiring manual installation of databases or caches on the host machine. It integrates well with the monorepo structure and can be easily parameterized using environment variables with fallback values.

### Alternatives Considered

- **Local installation**: Running PostgreSQL/Redis directly on the host machine. Rejected due to lack of reproducibility and potential conflicts between projects.

## Consequences

- All local infrastructure dependencies (e.g., PostgreSQL, Redis) must be added to `infra/docker-compose.yml`.
- Developers must have Docker and Docker Compose installed to run the local environment.
- Environment variables must use fallback values (e.g., `${POSTGRES_USER:-postgres}`) to ensure the setup works out-of-the-box without requiring a `.env` file for local development.
