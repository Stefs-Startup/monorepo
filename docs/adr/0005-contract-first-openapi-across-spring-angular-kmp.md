# ADR-0005: Contract-First OpenAPI 3.1 APIs Across Spring Boot 4, Angular 21 & KMP

**Status:** Accepted (Promoted from RFC-0003)  
**Date:** 2026-11-19  
**Deciders:** Stefan + Antigravity  

---

## Context

Prior to this decision (tracked in exploratory RFC-0003), `apps/pulse` maintained matching API models by hand across three languages and runtimes:
1. **Producer (`apps/pulse/backend`)**: Spring Boot 4 / Java 21 `record`s (`PulseDtos`, `PulseController` across 6 `/api/v1/pulse/*` endpoints).
2. **Web Consumer (`apps/pulse/web`)**: Hand-copied TypeScript interfaces in `pulse.models.ts` consumed via untyped string URLs in `PulseStateService`.
3. **KMP Consumer (`apps/pulse/kmp`)**: Kotlin Multiplatform (`commonMain`, `jvm`, `wasmJs`) pure domain models with divergent enum names (e.g. `LONG_STANDING_IDLE` vs. backend `LONG_STANDING_GHOSTED`, `COMMITTED_TOP_3` vs. `ACTIVE_COMMITTED`, `ACTIVE_FLOW` vs. `HEALTHY_BACKLOG`).

All RFC-0003 promotion triggers were met: 6 shared REST endpoints, 21 schema types (including 6 enums and 7 nullable fields), real cross-stack enum naming divergence, and the need for deterministic automated stale-client and breaking-change gates in CI.

## Decision

We standardize `apps/pulse` cross-stack HTTP APIs on a **Contract-First OpenAPI 3.1.0 pipeline** anchored by [`apps/pulse/contracts/pulse-api.openapi.json`](../../apps/pulse/contracts/pulse-api.openapi.json):

1. **Spring Boot 4 Code-First Producer with Pure Domain Boundary (`ADR-007`):**
   - `springdoc-openapi-starter-webmvc-ui` (`3.2.0`) exposes `/v3/api-docs` (`OPENAPI_3_1`, `/api/v1/pulse/**` only) and Swagger UI.
   - `OpenApiContractConfig` enforces deterministic sorted schemas, OpenAPI 3.1 `type: ["<type>", "null"]` nullability, strict `required` field sets, and reusable `#/components/schemas/<EnumName>` refs without adding Swagger/Spring annotations inside `com.pulse.backend.domain`.
   - `OpenApiContractExportTest` exports the canonical spec (`./gradlew exportOpenApiSpec`) and fails `./gradlew test` on any uncommitted schema drift.
2. **Angular 21 Zero-Runtime Typed Client (`openapi-typescript`):**
   - `openapi-typescript` generates `apps/pulse/web/src/app/api/generated/pulse-api.types.ts`.
   - `pulse.models.ts` re-exports generated schema types directly (zero duplicated DTO interfaces), and `PulseApiClient` binds `HttpClient` calls to generated `operations`.
3. **Kotlin Multiplatform Models-Only + Anti-Corruption Layer (`openapi-generator`):**
   - `org.openapi.generator` (`7.27.0`, `library = "multiplatform"`, `dateLibrary = "kotlinx-datetime"`, `models`-only) generates `@Serializable` data classes and enums into `apps/pulse/kmp/src/commonMain/kotlin/com/pulse/kmp/api/generated/`, compiling cleanly across both `jvm` and `wasmJs` (`ADR-008`).
   - `PulseApiContractMapper` translates generated wire DTOs into pure KMP domain types (`KmpTaskItem`, `AccountabilityCategory`) and configures `PulseApiJson` with `ignoreUnknownKeys = true` for Expand-and-Contract resilience.
4. **Unified Sync & `oasdiff` Breaking-Change CI Gate:**
   - [`scripts/api-contract.sh`](../../scripts/api-contract.sh) (`sync`, `check`, `breaking`, `changelog`, `drill`), wired into root `package.json`, `scripts/check.sh --gate contract`, and [`.github/workflows/ci-contract-pulse-api.yml`](../../.github/workflows/ci-contract-pulse-api.yml), blocks stale generated clients and breaking OpenAPI changes (`oasdiff --fail-on ERR`).

## Rationale

- **Compile-time safety across 3 languages:** Renaming a field or changing nullability in Java immediately surfaces as a TypeScript (`tsc --noEmit`) or Kotlin (`compileKotlinJvm` / `compileKotlinWasmJs`) compiler error instead of a silent runtime `undefined` or `SerializationException`.
- **Zero framework pollution in pure domain cores:** Both `com.pulse.backend.domain` (`ADR-007`) and `com.pulse.kmp.domain` (`ADR-008`) stay isolated behind `OpenApiContractConfig` and `PulseApiContractMapper`.
- **Safe Expand-and-Contract evolution:** `oasdiff` allows additive optional fields while blocking breaking removals/narrowings, and `ignoreUnknownKeys = true` lets older KMP/Wasm clients tolerate new server fields.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Spec-first hand-authored YAML + generated Spring interfaces** | Adds Spring server stub boilerplate and fights rapid Java 21 `record` iteration while Code-First + committed canonical JSON + `OpenApiContractExportTest` achieves the exact same committed-contract guarantee. |
| **Full KMP client SDK generation (`apis = true`)** | Generates bloated Ktor infrastructure that requires template patching for `ignoreUnknownKeys` and complicates `wasmJs` bundling; Models-Only + `PulseApiContractMapper` keeps `commonMain` lean. |
| **gRPC / Protobuf or GraphQL** | gRPC adds browser gRPC-Web/Envoy proxy complexity over Cloud Run + Nginx (`ADR-0004`); GraphQL adds unnecessary runtime/caching complexity for 6 well-defined dashboard endpoints. |

## Consequences

- **Positive:** One deterministic command (`bash scripts/api-contract.sh sync`) updates the OpenAPI 3.1 spec, Angular types, and KMP models; `scripts/check.sh --gate contract` and CI catch drift and breaking changes automatically.
- **Trade-off:** Changing any Spring Boot API DTO or controller requires running `bash scripts/api-contract.sh sync` and committing generated files alongside the backend change.
- **Trade-off (`SHRINK_TO_5_M` naming):** `openapi-generator` maps `SHRINK_TO_5M` to Kotlin enum constant `SHRINK_TO_5_M` with `@SerialName("SHRINK_TO_5M")`, preserving wire compatibility while differing slightly in Kotlin source identifier style.
