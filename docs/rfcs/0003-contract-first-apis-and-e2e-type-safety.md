# RFC-0003: Contract-First APIs Across Spring Boot 4, Angular 21 & KMP

- **Status:** `Exploring`
- **Date:** 2026-11-19
- **Author:** Stefan + Antigravity
- **Related:** `apps/pulse/backend/`, `apps/pulse/web/`, `docs/knowledge-base/spring/`, `docs/knowledge-base/angular/`

---

## 1. What It Is (Mental Model)

Using an **OpenAPI 3.1 spec** as the single source of truth between your Spring Boot 4 backend and your Angular 21 / Kotlin Multiplatform clients — automatically generating TypeScript types/API clients and failing CI if a backend PR introduces a breaking API change without updating consumers.

---

## 2. Problems It Solves

In a polyglot monorepo (`Java 21 + Spring Boot 4` backend, `TypeScript + Angular 21` web, `Kotlin` mobile/Wasm):
- Hand-writing matching DTOs in 3 languages causes **silent runtime bugs** when a field is renamed, becomes nullable, or changes enum values.
- Frontend and backend developers (or AI agents!) drift out of sync when schemas live in separate files with no automated contract check.

---

## 3. Core Concepts to Learn

| Concept | Tooling Example | Payoff |
|---|---|---|
| **Code-First vs. Spec-First OpenAPI** | `springdoc-openapi` (generates `openapi.json` from Spring controllers/records) or `openapi.yaml` -> `openapi-generator` | Always-accurate API docs + machine-readable contract |
| **Generated Typed Clients** | `openapi-typescript` / `orval` -> Angular Signal/Resource services; `OpenAPI Generator` -> Kotlin data classes | Compile-time errors in Angular/Kotlin the instant a backend field changes |
| **Breaking-Change Detection in CI** | `oasdiff breaking base.json head.json` | Catches removed endpoints, tightened types, or new required fields on PRs |
| **Expand-and-Contract Evolution** | Add new optional field -> migrate clients -> deprecate & remove old field | Zero-downtime deploys when mobile/web clients lag behind backend |

---

## 4. Alternatives & When to Pick Each

| Approach | Strengths | Trade-offs |
|---|---|---|
| **REST + OpenAPI 3.1** (Recommended default) | Universal HTTP tooling, caching, simple debugging, great Spring Boot + Angular support | Requires discipline to regenerate client on schema change |
| **gRPC / Protobuf** | Strict binary schemas, streaming, great for service-to-service | Clunkier in browsers (needs gRPC-Web / Envoy proxy) |
| **GraphQL** | Flexible client queries for deeply nested graphs | Overkill for most CRUD apps; caching & N+1 complexity |

---

## 5. Triggers to Promote to an ADR

- [ ] `apps/pulse/backend` and `apps/pulse/web` share 5+ real API endpoints with non-trivial DTOs.
- [ ] You catch yourself manually copying a Java `record` field change into TypeScript interfaces more than twice.
- [ ] Add a `pnpm api:sync` (or Gradle + pnpm) check in CI that fails if generated client types are stale.
