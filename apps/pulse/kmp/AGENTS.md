# Agent Guidelines (`apps/pulse/kmp`)

Kotlin Multiplatform (`jvm` + `wasmJs`) shared module for Pulse. Keep changes aligned with [../AGENTS.md](../AGENTS.md) and root `AGENTS.md`.

## Build & Test

Run inside `apps/pulse/kmp` (or via repo root `scripts/check.sh`):

```bash
scripts/check.sh --stack kmp

# Or run directly inside apps/pulse/kmp:
./gradlew codeQuality --stacktrace
./gradlew jvmJar compileProductionExecutableKotlinWasmJs --stacktrace
./gradlew jvmTest --stacktrace
```

## Conventions

- **Multiplatform Targets**: Kotlin `2.1.0` targeting `jvm` (`jvmToolchain(17)`) and `wasmJs` browser binary (`pulse-kmp-web`).
- **CommonMain Purity (`ADR-008` / `ADR-009`)**: `./gradlew codeQuality` compiles `commonMain`, `jvm`, and `wasmJs` metadata and rejects banned non-multiplatform imports (`java.time.*`, `java.util.UUID`, `android.*`) in `src/commonMain/kotlin`.
- **Multiplatform Libraries**: Use `kotlinx-datetime` and `kotlinx-serialization-json` instead of JDK time/reflection APIs.

## Do Not Touch

- **Do NOT import `java.*` or `android.*` inside `src/commonMain/kotlin`**.
- **Do NOT remove `wasmJs` compilation** from verification or add `apps/pulse/kmp` to root `pnpm-workspace.yaml`.

## Common Pitfalls

- Code that passes `jvmTest` can still break `compileKotlinWasmJs` (e.g., `java.time.Instant` or `String.format`); always run `./gradlew codeQuality`.
- Note that `kmp` pins `jvmToolchain(17)` while `backend` uses JDK 21 (`mise.toml` sets `KMP_JVM_TOOLCHAIN="17"` with JDK 21 host).
