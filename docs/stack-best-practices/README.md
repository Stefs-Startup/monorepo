# Engineering Stack Best Practices & Framework Learning Library

> **Human-Readable Reference Library (`Docs-as-Code`)**: Each framework and stack used across our applications has its own dedicated, self-contained learning guide below, grounded in **real, working examples and lessons learned from our production/experimental apps** (`apps/pulse/`).

---

## 📚 Framework & Stack Guides

| Guide | Stack / Framework | What You Will Learn & Real App Examples Included |
| :--- | :--- | :--- |
| **[1. Kotlin (`2.1+`) & Pure Functional Core](01_KOTLIN_PURE_DOMAIN_BEST_PRACTICES.md)** | **Kotlin `2.1`**, Coroutines, `StateFlow`, `kotlinx.serialization` | Writing zero-framework pure domain engines (`UndoneAccountabilityEngine`, `TaskVisualAnalyticsEngine`, `ScarcityEngine`, `TriageRules`, `WcagContrastEngine`), sealed ADTs, and deterministic unit testing. |
| **[2. Kotlin Multiplatform (`KMP`) Architecture](02_KMP_MULTIPLATFORM_BEST_PRACTICES.md)** | **Kotlin Multiplatform (`commonMain`, `androidMain`, `wasmJsMain`)** | Structuring shared modules, replacing JVM-only APIs (`java.time` -> `kotlinx-datetime`, `UUID` -> `kotlin.uuid.Uuid`), `expect`/`actual` platform bridges, and multiplatform test pyramids (`commonTest`). |
| **[3. Compose Multiplatform & Modern Desktop Web UX](03_COMPOSE_MULTIPLATFORM_AND_DESKTOP_WEB_BEST_PRACTICES.md)** | **Compose Multiplatform (`1.7+`)**, `wasmJs`, Material 3 + Modern Web UX | Sharing 100% of Compose UI components (`AccountabilityHorizonCanvas`, `StalledTaskLogCard`, `PartnerSettingsNavigator`) while applying **modern desktop web principles** (multi-pane split workspaces, `1px` hairline borders, hover states, keyboard shortcuts) alongside mobile touch layouts. |
| **[4. Firebase Crashlytics, Analytics & Zero-PII Observability](04_FIREBASE_OBSERVABILITY_AND_ZERO_PII_BEST_PRACTICES.md)** | **Firebase (`gw-cli-490302`)**, Crashlytics, Analytics, Timber | Ensuring the **Firebase Dashboard is actively populated** across Android (`FirebaseCrashlytics` + `FirebaseAnalytics`) and Web (`firebase-js-sdk`), zero-PII regex scrubbing (`PulseObservability.scrubSensitiveText`), SHA-256 pseudonymization, and 1-tap diagnostic verification. |
| **[5. Spring Boot 4 & Modern Java 21 Backend](05_SPRING_BOOT_4_AND_JAVA_21_BEST_PRACTICES.md)** | **Spring Boot `4.0.9`**, **Java `21`**, Jakarta Validation, `MockMvc` | Modeling domain rules with Java 21 `record` DTOs, `sealed interface` hierarchies (`PinDecision`, `TriageAction`), exhaustive pattern-matching `switch` expressions, stateless REST controllers (`PulseController`), and `MockMvc` contract testing. |
| **[6. Angular 21 Standalone Signals & Modern Web](06_ANGULAR_21_SIGNALS_AND_WEB_BEST_PRACTICES.md)** | **Angular `21.2+`**, Standalone Components, Signals, Vitest 4 | Fine-grained reactivity (`signal()`, `computed()`), native template control flow (`@if`, `@for`, `@switch`), Material 3 Expressive CSS custom properties with automated WCAG 2.2 AA contrast verification, and Vitest component contract testing. |

---

## 🧭 Core Cross-Stack Principles (Learned from Building `Pulse`)

1. **Pure Functional Core First (`ADR-007`)**:
   - Whether written in **Kotlin (`2.1`)**, **Java (`21`)**, or **TypeScript (`5.9`)**, domain engines must be 100% stateless and free of UI/framework dependencies (`Context`, `HttpServletRequest`, `DOM`).
2. **Share Native Components & Respect Desktop Web Ergonomics (`ADR-008` & `ADR-009`)**:
   - Duplicating a rich Jetpack Compose UI in hand-rolled Angular CSS creates visual drift and doubles maintenance. Using **KMP + Compose Multiplatform (`commonMain` + `wasmJsMain`)** shares ~95% of the codebase while adapting layouts to **modern desktop web principles** on wide screens (`>= 840.dp`).
3. **Observability Must Be Verifiable in the Live Dashboard**:
   - Telemetry is only useful if it reaches the **Firebase Console (`gw-cli-490302`)** with zero PII leakage (`[REDACTED_EMAIL]`, `[REDACTED_TOKEN]`) and includes an in-app `"Send Test Telemetry"` trigger for immediate verification.

---

## 🏭 Agentic Software Factory Guides (`docs/software-factory/`)

To see how these stack standards are scaffolded, enforced, and verified automatically across the monorepo:
- **[Software Factory Overview](../software-factory/README.md)** — 4-stage closed-loop factory architecture
- **[01. From Portals to Agentic Workspaces](../software-factory/01-from-portals-to-agentic-workspaces.md)** — `AGENTS.md` constitutions, pnpm boundaries, and Turborepo orchestration
- **[02. Shared Guardrail Primitives](../software-factory/02-shared-guardrail-primitives.md)** — `@cmp/utils` WCAG 2.2 AA, Zero-PII, and scarcity engines
- **[03. Deterministic App & Slice Generators](../software-factory/03-deterministic-app-and-slice-generators.md)** — `pnpm gen:app` & `pnpm gen:slice` vertical slice scaffolding
- **[04. Closed-Loop Verification Harness](../software-factory/04-closed-loop-verification-harness.md)** — `pnpm verify:slice` three-gate verification loop
