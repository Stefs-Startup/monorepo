# Pulse — Material 3 Expressive Accountability Partner for Google Tasks

Pulse is a calm accountability partner for **Google Tasks** built around a **Pure Functional Core (`ADR-007`)** and **Kotlin Multiplatform (KMP) + Compose Multiplatform (`ADR-008`)**:
- **Primary Multiplatform Architecture (`app/` -> KMP `commonMain`, `androidMain`, `wasmJsMain`)**: Native **Kotlin (`2.1.0`)** domain engines + **Compose Multiplatform (Material 3 Expressive)** shared across Android and Web (`wasmJs`), bringing 95%+ of the native Android code, spring animations (`HorizontalPager`), and theme tokens directly to the browser without a separate backend.
- **Experimental Web & API Archive (`web/` + `backend/` — `v0.6.0–v0.6.2`)**: **Angular 21 (`21.2.26`)** + **Spring Boot 4 (`4.0.9` / Java 21)** exploration preserved in the monorepo as an experimental reference.

## Requirements

- `REQ-PULSE-001`: `ADR-007` pure functional domain core (`com.pulse.backend.domain`) remains free of Spring/Servlet/Lombok dependencies, and REST API controllers/DTOs preserve their documented contract.

Instead of acting as a second, cluttered task manager, Pulse focuses on rescuing habitually undone work and guiding honest daily focus through a distraction-free **Visual Focus Dashboard (`EPIC-1`)** and **Daily Ritual Stickiness Loops (`EPIC-4`)**:
1. **Single-Viewport Visual Focus Dashboard (`Horizon` — `EPIC-1`)** — Partitions your tasks into 3 analytical windows (*Habitually Undone*, *Long-Standing Drift*, *Committed & Active Flow*) ranked in strict descending order (`#1`, `#2`, `#3`...) with a 3-slot **Today's Top 3** scarcity gate, swap modal, and synchronized **Selected Task Inspector** (zero chat FAB clutter).
2. **Structured Visual Audit Trail (`Undone Log` — `EPIC-1`)** — Dedicated secondary surface using reusable [`StalledTaskLogCard.kt`](app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt) / [`stalled-task-card.component.ts`](web/src/app/components/stalled-task-card/stalled-task-card.component.ts) cards for 1-tap visual triage (*Pin to Top 3*, *Shrink to 5m Starter*, *Tomorrow*, *Park Someday*, *Done ✓*).
3. **Categorized Multi-Page Settings (`Settings` — `EPIC-3`)** — Clean 4-card index ([`PartnerSettingsNavigator.kt`](app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) / [`settings-navigator.component.ts`](web/src/app/components/settings-navigator/settings-navigator.component.ts)) covering *Partner Persona & AI*, *Google Tasks Sync*, *Cadence & Rituals*, and *Privacy & Diagnostics*.
4. **Habitual & Ritual Stickiness (`EPIC-4`) & Deferred Chat (`EPIC-5`)** — Morning Anchor & Evening Honest Shutdown ritual tie-ins ([`docs/tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md`](docs/tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md)) keep users engaged daily, while conversational Partner Chat is saved for `EPIC-5`.

---

## Docs-as-Code Knowledge Base

Per [`AGENTS.md`](AGENTS.md), **no version or sprint story is considered Done** unless its in-repository documentation and changelog entry are updated and committed in lockstep with the code:

- **[`AGENTS.md`](AGENTS.md)** — Engineering Constitution, Epic-Stream planning rules, Pure Functional Core (`ADR-007`), Test Pyramid, and WCAG 2.2 AA accessibility gate.
- **[`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](docs/SPRINT_ROADMAP_AND_USE_CASES.md)** — Executive Epic Streams (`EPIC-1`..`EPIC-5`), Prime Use Cases (`UC-1`..`UC-5`), and internal compartmentalized technical tickets (`TKT-xxx`).
- **[`docs/UX_FLOW_AND_DESIGN_SYSTEM.md`](docs/UX_FLOW_AND_DESIGN_SYSTEM.md)** — Visual Focus Dashboard interaction diagram (`mermaid`), navigation architecture, and Material 3 Expressive token contrast specification.
- **[`docs/CHANGELOG.md`](docs/CHANGELOG.md)** — Version-by-version release history linked to Git commits and Prime Use Cases.
- **Technical Reference & Stack Best-Practices Library (`docs/tech-docs/`)**:
  - **[`docs/tech-docs/STACK_BEST_PRACTICES.md`](docs/tech-docs/STACK_BEST_PRACTICES.md) & [`docs/tech-docs/best-practices/`](docs/tech-docs/best-practices/README.md)** — Dedicated, human-readable best-practice guides with real examples from our apps for each stack:
    1. [Kotlin (`2.1+`) & Pure Functional Domain](docs/tech-docs/best-practices/01_KOTLIN_PURE_DOMAIN_BEST_PRACTICES.md)
    2. [Kotlin Multiplatform (`KMP`) Architecture](docs/tech-docs/best-practices/02_KMP_MULTIPLATFORM_BEST_PRACTICES.md)
    3. [Compose Multiplatform & Modern Desktop Web UX (`ADR-009`)](docs/tech-docs/best-practices/03_COMPOSE_MULTIPLATFORM_AND_DESKTOP_WEB_BEST_PRACTICES.md)
    4. [Firebase Crashlytics, Analytics & Zero-PII Observability](docs/tech-docs/best-practices/04_FIREBASE_OBSERVABILITY_AND_ZERO_PII_BEST_PRACTICES.md)
    5. [Spring Boot 4 & Modern Java 21 Backend](docs/tech-docs/best-practices/05_SPRING_BOOT_4_AND_JAVA_21_BEST_PRACTICES.md)
    6. [Angular 21 Standalone Signals & Modern Web](docs/tech-docs/best-practices/06_ANGULAR_21_SIGNALS_AND_WEB_BEST_PRACTICES.md)
  - **[`docs/tech-docs/FULL_STATE_DEBRIEF_AND_VERIFICATION_REPORT.md`](docs/tech-docs/FULL_STATE_DEBRIEF_AND_VERIFICATION_REPORT.md)** — Migrated from Google Drive (`1HOPr0cj2NqOZrRwHn0j-k8rfi8vZonUrk0uQB9PQtaE`) and updated with the 3-tier Test Pyramid & Visual Focus readiness matrix.
  - **[`docs/tech-docs/TECH_STACK_RUNBOOK_AND_KNOWLEDGE_SOURCES.md`](docs/tech-docs/TECH_STACK_RUNBOOK_AND_KNOWLEDGE_SOURCES.md)** — Migrated from Google Drive (`1Fz7vE46pcEZmPEuPn71tMpQcLeg_vIry6DJNUhRMlgg`) and updated for the Angular 21 + Spring Boot 4 / Java 21 + Android stack.
  - **[`docs/tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md`](docs/tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md)** — Behavioral design & pure functional specification for `EPIC-4` (Morning Anchor, Evening Shutdown, and Zero-Guilt Consistency Streaks).

---

## Architecture & Key Modules

- **Pure Domain & Accessibility Core (`zero Android Context`)**
  - [`UndoneAccountabilityEngine.kt`](app/src/main/java/com/pulse/accountability/domain/UndoneAccountabilityEngine.kt): Classifies habitually undone (`3x+` deferrals) and long-standing idle (`5d+`) tasks.
  - [`TaskVisualAnalyticsEngine.kt`](app/src/main/java/com/pulse/accountability/domain/TaskVisualAnalyticsEngine.kt): Computes the 3 swipeable Horizon windows and sorts bars in strict descending order.
  - [`ScarcityEngine.kt`](app/src/main/java/com/pulse/accountability/domain/ScarcityEngine.kt): Enforces the 3-slot Today's Top 3 commitment cap.
  - [`WcagContrastEngine.kt`](app/src/main/java/com/pulse/accountability/ui/theme/WcagContrastEngine.kt): Pure WCAG 2.2 relative luminance and contrast ratio verifier (`>= 4.5:1`).
- **UI & Modular Reactive Components**
  - [`MainActivity.kt`](app/src/main/java/com/pulse/accountability/MainActivity.kt): Compact `TopAppBar`, 3-tab `NavigationBar` (`Horizon`, `Undone Log`, `Settings`), and `Reflect` Extended FAB.
  - [`AccountabilityHorizonCanvas.kt`](app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt): Swipeable 3-window `HorizontalPager` carousel.
  - [`PartnerChatComponent.kt`](app/src/main/java/com/pulse/accountability/ui/components/chat/PartnerChatComponent.kt): Decoupled, swappable reactive chat overlay with `PartnerChatMapper` and `rememberLazyListState()` auto-scrolling.
  - [`StalledTaskLogCard.kt`](app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt) & [`PartnerSettingsNavigator.kt`](app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt): Reusable log cards and multi-page settings navigator.
- **Data, Native Google OAuth & Zero-PII Telemetry**
  - [`GoogleAuthCredentialHelper.kt`](app/src/main/java/com/pulse/accountability/data/auth/GoogleAuthCredentialHelper.kt) & [`GoogleAuthDiagnostics.kt`](app/src/main/java/com/pulse/accountability/data/auth/GoogleAuthDiagnostics.kt): 1-tap Play Services OAuth (`oauth2:https://www.googleapis.com/auth/tasks`) and pure failure classification.
  - [`GoogleTasksApiClient.kt`](app/src/main/java/com/pulse/accountability/data/remote/GoogleTasksApiClient.kt): REST client for Google Tasks API v1 (`tasks.googleapis.com/tasks/v1`).
  - [`PulseObservability.kt`](app/src/main/java/com/pulse/accountability/util/PulseObservability.kt): Zero-PII scrubber and Firebase Crashlytics breadcrumb/report dispatcher.

---

## Build, Test & Run

### 1. Spring Boot 4 + Java 21 Backend (`backend/`)
```bash
# Run JUnit 5 pure domain, WCAG 2.2 AA, zero-PII, and MockMvc contract tests
cd backend && ./gradlew test

# Start the Spring Boot 4 REST server on http://localhost:8080
cd backend && ./gradlew bootRun
```

### 2. Angular 21 Standalone Signals Web App (`web/`)
```bash
# Run Vitest unit & WCAG 2.2 AA contrast tests
cd web && npm test

# Build production bundle
cd web && npm run build

# Start Angular 21 dev server on http://localhost:4200 (proxying /api -> http://localhost:8080)
cd web && npm start
```

### 3. Android Native App (`app/`)
```bash
# Run all pure unit, contract, and WCAG 2.2 AA accessibility tests
./gradlew testDebugUnitTest

# Build and install debug APK onto connected devices (emulator-5554 / Pixel 8 Pro)
./gradlew installDebug
```
