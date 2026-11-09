# 2. Kotlin Multiplatform (`KMP`) Architecture Best Practices

> **Stack Scope**: Kotlin Multiplatform (`2.1.0`), `commonMain`, `androidMain`, `wasmJsMain`, `kotlinx-datetime`, `kotlinx-serialization`, and `commonTest`.
> **Real App Reference**: `apps/pulse/` (`ADR-008` KMP + Compose Multiplatform Strategy)

---

## 1. Why KMP Over Separate Web + Mobile Rewrites (`ADR-008`)

### Lesson Learned in `Pulse`
We initially built an experimental Angular 21 (`web/`) + Spring Boot 4 (`backend/`) companion alongside our native Android app (`app/`). Even with clean architecture, maintaining **three copies of the domain engines** (Kotlin, Java 21, TypeScript) and **two separate UI frameworks** (Jetpack Compose vs. Angular CSS) caused immediate visual parity gaps and tripled maintenance effort.

With **Kotlin Multiplatform (`KMP`) + Compose Multiplatform (`wasmJs`)**:
- **~95% of the codebase lives in `commonMain`** (domain engines, view models/state holders, Material 3 + Desktop Web adaptive Compose components, and PII scrubbers).
- **`androidMain` (~3%)** provides Android-specific persistence (`Room`/`DataStore`), Play Services OAuth, and `FirebaseCrashlytics`.
- **`wasmJsMain` (~2%)** provides the browser canvas entrypoint, `localStorage` persistence, and the Firebase Web JS SDK telemetry bridge.

---

## 2. Source-Set Layout & Strict Dependency Rules

```text
shared/ (or app KMP module)
├── src/commonMain/kotlin/com/pulse/accountability/
│   ├── domain/          # 100% pure Kotlin engines (Undone, Horizon, Scarcity, Triage, Ritual, WCAG)
│   ├── observability/   # PulseObservability scrubber + expect/actual platform telemetry sink
│   └── ui/              # Shared responsive Compose components & theme
├── src/commonTest/kotlin/com/pulse/accountability/
│   └── ...              # Multiplatform unit & state contract tests (runs on JVM + Wasm)
├── src/androidMain/kotlin/com/pulse/accountability/
│   └── ...              # Android MainActivity, Room DB, Play Services OAuth, Firebase Android SDK
└── src/wasmJsMain/kotlin/com/pulse/accountability/
    └── ...              # Browser main.kt, responsive desktop shell, Firebase Web JS bridge
```

### Banned Imports in `commonMain` (and Their KMP Replacements)

| JVM / Android API (Banned in `commonMain`) | Multiplatform KMP Replacement (`commonMain`) | Example in `Pulse` |
| :--- | :--- | :--- |
| `java.time.LocalDate`, `Instant`, `ZoneId` | `kotlinx.datetime.LocalDate`, `Instant`, `TimeZone` | `TaskItemEntity.daysOverdue()`, `TriageRules.kt` |
| `java.util.UUID.randomUUID()` | `@OptIn(ExperimentalUuidApi::class) Uuid.random().toString()` | `ConversationalMessage.id` |
| `System.currentTimeMillis()` | `kotlinx.datetime.Clock.System.now().toEpochMilliseconds()` | Default timestamps in `TaskItemEntity` |
| `java.security.MessageDigest` (`SHA-256`) | Pure Kotlin SHA-256 / FNV-1a or `expect fun sha256Hex()` | `PulseObservability.pseudonymizeIdentifier()` |
| `String.format("%02x", byte)` | `byte.toUByte().toString(16).padStart(2, '0')` | Hex encoding without `java.util.Formatter` |

---

## 3. Prefer Interfaces & Lambdas Over Heavy `expect` / `actual` Hierarchies

Use `expect` / `actual` only for thin leaf utilities (such as platform telemetry dispatch or clock/storage initialization). For repositories and OAuth providers, define a **plain Kotlin `interface` in `commonMain`** and inject the platform implementation from `androidMain` or `wasmJsMain`.

```kotlin
// In commonMain:
interface TelemetrySink {
    fun logBreadcrumb(safeMessage: String)
    fun recordNonFatal(tag: String, throwable: Throwable, attributes: Map<String, String>)
    fun flushUnsentReports()
}
```

---

## 4. Checklist for KMP Migrations
- [ ] Replace all `java.time.*` and `java.util.*` usages in domain models with `kotlinx-datetime` and Kotlin stdlib primitives.
- [ ] Strip `@Entity` / `@PrimaryKey` Room annotations from shared `commonMain` domain models (or keep Room entities in `androidMain` with a 1-line `.toDomain()` mapper).
- [ ] Run `./gradlew testDebugUnitTest` and `./gradlew wasmJsTest` on every commit.
