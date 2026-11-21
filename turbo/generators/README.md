# `turbo/generators/` — Monorepo Code Generators (`pnpm gen`)

Deterministic scaffolding engine (`scripts/gen.mjs` + `turbo/generators/config.ts`) that creates new packages and apps pre-wired with shared configs, CI discovery, `AGENTS.md`, `README.md`, and starter tests.

## Available Generators

```bash
# TypeScript library in packages/<name> (extends @cmp/config, node:test)
pnpm gen lib <name>

# Angular 21 Signals web app in apps/<name> (Vitest, @cmp/config, auth slot)
pnpm gen app web <name>

# Spring Boot 4 service in apps/<name> (stefs.jvm-service, /actuator/health, springdoc OpenAPI)
pnpm gen app service <name> [--infra]   # --infra adds compose.yaml for Postgres + Redis

# Android Kotlin/Compose app in apps/<name> (stefs.android-app, edge-to-edge, unit test)
pnpm gen app android <name>
```

## CI Smoke Verification

[`.github/workflows/template-smoke.yml`](../../.github/workflows/template-smoke.yml) and `scripts/gen.test.mjs` run automatically whenever `turbo/generators/`, `scripts/gen.*`, or shared packages change — scaffolding throwaway instances of every template and verifying lint, typecheck, build, and tests end-to-end.
