# `apps/pulse/kmp` — Kotlin Multiplatform Domain & Telemetry Core

Pure Kotlin Multiplatform (`jvm` + `wasmJs`) module containing Pulse's shared domain logic, generated OpenAPI models (`org.openapi.generator`), Zero-PII observability (`ZeroPiiTelemetry`), and feature-flag evaluation (`PulseFlagsAndExperimentEngine`).

Built with `id("stefs.kotlin-lib")` from [`build-logic/`](../../../build-logic/README.md) and root [`gradle/libs.versions.toml`](../../../gradle/libs.versions.toml).

## Build & Verification

```bash
cd apps/pulse/kmp
./gradlew codeQuality
./gradlew jvmJar compileProductionExecutableKotlinWasmJs
./gradlew jvmTest
./gradlew syncPulseApiModels     # Regenerate Kotlin models from apps/pulse/contracts/pulse-api.openapi.json
```

From the repo root: `./scripts/check.sh --stack kmp` (or `pnpm api:sync` to sync backend + web + KMP together).
