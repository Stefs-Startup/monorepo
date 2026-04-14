# ADR-0003: Docker Compose for Local Infrastructure

**Status:** Accepted
**Date:** 2024-04-14
**Deciders:** Company of One

---

## Context

As we build out applications (like our Backstage instance, APIs, etc.), we need backing services such as PostgreSQL and Redis for local development. Managing these services manually via local installations creates "it works on my machine" issues and slows down onboarding for human developers and setup for agents.

## Decision

We will use Docker Compose (`infra/docker-compose.yml`) to orchestrate local infrastructure services.

## Rationale

- **Consistency**: Docker provides a consistent environment across different machines.
- **Simplicity**: A single `docker-compose up` command brings up the entire backing infrastructure.
- **Isolation**: Services run in containers and don't pollute the host OS.
- **Declarative**: The infrastructure requirements are documented in code.

### Alternatives Considered

- **Local installations (Homebrew/apt)**: Rejected due to version inconsistencies and manual setup overhead.
- **SaaS for dev (e.g., Supabase cloud for dev)**: Rejected to allow offline development and reduce latency/cost during the dev cycle.

## Consequences

- Developers and agents must have Docker installed to run the local stack.
- The `infra/docker-compose.yml` file is the single source of truth for local backing services.
- Environment variables for these services should be managed via `.env` files (with `.env.example` checked into git).
