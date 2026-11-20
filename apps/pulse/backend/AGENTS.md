# Agent Guidelines (`apps/pulse/backend`)

Spring Boot 4 / Java 21 REST backend for Pulse. Keep changes aligned with [../AGENTS.md](../AGENTS.md) and root `AGENTS.md`.

## Build & Test

Run inside `apps/pulse/backend` (or via repo root `scripts/check.sh`):

```bash
scripts/check.sh --stack springboot

# Or run directly inside apps/pulse/backend:
./gradlew codeQuality --stacktrace
./gradlew bootJar testClasses --stacktrace
./gradlew test --stacktrace
./gradlew pitest --stacktrace
```

## Conventions

- **Toolchain**: Java `21` (`JavaLanguageVersion.of(21)`), Spring Boot `4.1.2`, Gradle `8.14.6`, compiled with `-Xlint:all,-serial,-processing -parameters`.
- **Pure Domain Boundaries (`ADR-007`)**: Classes under `com.pulse.backend.domain` MUST NOT import `org.springframework.*`, `jakarta.servlet.*`, or `lombok.*` — enforced by both `./gradlew codeQuality` and ArchUnit (`ArchitectureTest.java`).
- **Idiomatic Java 21**: Prefer Java 21 `record` types and sealed interfaces over Lombok annotations.

## Do Not Touch

- **Do NOT weaken `codeQuality` or `ArchitectureTest.java`** to bypass domain purity checks.
- **Do NOT add `apps/pulse/backend` to root `pnpm-workspace.yaml`**.
- **Do NOT introduce Lombok** into `build.gradle.kts` or domain/API sources.

## Common Pitfalls

- Using JDK 17 fails compilation — backend explicitly requires JDK 21 (unlike KMP/Android which target bytecode 17).
- Spring Boot 4 uses modular starters (`spring-boot-starter-webmvc`, `spring-boot-starter-webmvc-test`); legacy Boot 3 starter coordinates break resolution.
- Forgetting `./gradlew codeQuality` before pushing delays failures to Gate 1 in CI.
