# `apps/pulse/backend` — Spring Boot 4 / Java 21 API

REST API and OpenAPI 3.1 contract source of truth for Pulse, built on `stefs.jvm-service` ([`build-logic/`](../../../build-logic/README.md)) and packaged as a Distroless JRE 21 container (`316 MB`, non-root).

## Local Quickstart

```bash
cd apps/pulse/backend
./gradlew bootRun                # Starts API on http://localhost:8080
```

## Verification & OpenAPI Contracts

```bash
./gradlew codeQuality            # Checkstyle / Spotless / static checks
./gradlew test                   # Unit tests + ArchUnit (ArchitectureTest) + probe contracts
./gradlew exportOpenApiSpec      # Exports OpenAPI 3.1 JSON spec
```

From the repo root, keep Angular & KMP clients in sync with backend DTO/endpoint changes:

```bash
pnpm api:sync                    # Export OpenAPI spec + regenerate TS & KMP clients
pnpm api:check                   # Verify zero contract drift
./scripts/check.sh --stack springboot
```

## Health Probes & Deployment

- **Liveness:** `GET /actuator/health/liveness`
- **Readiness:** `GET /actuator/health/readiness`
- **Info / Revision:** `GET /actuator/info`
- **Container:** [`Dockerfile`](./Dockerfile) with pure-JDK `HttpHealthProbe` (`docker/HttpHealthProbe.java`), deployed to Cloud Run via `scripts/deploy.sh --surface pulse-backend`.
