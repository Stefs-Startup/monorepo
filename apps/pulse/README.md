# Pulse — Material 3 Expressive Accountability Partner for Google Tasks

Pulse is a calm accountability partner for **Google Tasks** built around a **Pure Functional Core (`ADR-007`)** across two client/server stacks in this monorepo:
- **Android Native App (`app/`)**: **Kotlin**, **Jetpack Compose (Material 3 Expressive)**, and **Room**.
- **Web & API Stack (`web/` + `backend/`)**: **Angular 21 (`21.2.26`)** Standalone Signals SPA + **Spring Boot 4 (`4.0.9`)** on **Java 21**.

Instead of acting as a second, cluttered task manager, Pulse focuses on rescuing habitually undone work and guiding honest daily focus:
1. **Single-Viewport Swipeable Horizon (`Horizon`)** — Partitions your tasks into 3 analytical windows (*Habitually Undone*, *Long-Standing Drift*, *Committed & Active Flow*) ranked in strict descending order (`#1`, `#2`, `#3`...) with a 3-slot **Today's Top 3** strip.
2. **FAB-Routed Reactive Partner Chat (`Reflect` FAB)** — Tapping any task bar or the `Reflect` Extended FAB launches the decoupled, swappable partner chat overlay ([`PartnerChatComponent.kt`](app/src/main/java/com/pulse/accountability/ui/components/chat/PartnerChatComponent.kt) / [`partner-chat-overlay.component.ts`](web/src/app/components/partner-chat/partner-chat-overlay.component.ts)) to talk through blockers, shrink daunting work into a 5-minute starter step, or commit to Today's Top 3.
3. **Structured Audit Trail (`Undone Log`)** — Dedicated secondary surface using reusable [`StalledTaskLogCard.kt`](app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt) / [`stalled-task-card.component.ts`](web/src/app/components/stalled-task-card/stalled-task-card.component.ts) cards for 1-tap triage of chronically deferred (`2x+`) and neglected (`5d+`) tasks.
4. **Categorized Multi-Page Settings (`Settings`)** — Clean 4-card index ([`PartnerSettingsNavigator.kt`](app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) / [`settings-navigator.component.ts`](web/src/app/components/settings-navigator/settings-navigator.component.ts)) covering *Partner Persona & AI*, *Google Tasks Sync*, *Cadence & Rituals*, and *Privacy & Diagnostics*.

---

## Docs-as-Code Knowledge Base

Per [`AGENTS.md`](AGENTS.md), **no version or sprint story is considered Done** unless its in-repository documentation and changelog entry are updated and committed in lockstep with the code:

- **[`AGENTS.md`](AGENTS.md)** — Engineering Constitution, Pure Functional Core rules, WCAG 2.2 AA accessibility gate, and Mandatory Docs-as-Code Release Gate.
- **[`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](docs/SPRINT_ROADMAP_AND_USE_CASES.md)** — The 5 Prime Use Cases (`UC-1`..`UC-5`), Closed-Loop Feedback Architecture, and Multi-Sprint Plan (`Sprint 1: v0.6.0`, `Sprint 2: v0.7.0`) with deterministic Acceptance Criteria.
- **[`docs/UX_FLOW_AND_DESIGN_SYSTEM.md`](docs/UX_FLOW_AND_DESIGN_SYSTEM.md)** — Living UX flow, navigation architecture, and Material 3 Expressive token contrast specification.
- **[`docs/CHANGELOG.md`](docs/CHANGELOG.md)** — Version-by-version release history linked to Git commits and Prime Use Cases.

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
