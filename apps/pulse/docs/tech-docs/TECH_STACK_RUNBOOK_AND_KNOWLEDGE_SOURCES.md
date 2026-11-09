# Pulse — Tech Stack, Need-to-Know Runbook & Knowledge Sources

> **Docs-as-Code Provenance**: Migrated from Google Drive (`1Fz7vE46pcEZmPEuPn71tMpQcLeg_vIry6DJNUhRMlgg`) into version-controlled `docs/tech-docs/` and updated for **`v0.6.2` (Angular 21 + Spring Boot 4 / Java 21 + Android Monorepo)**.

---

## 1. Architectural Philosophy & Multi-Platform Technology Stack

Pulse is architected around a **Pure Functional Core (`ADR-007`)**, **Material 3 Expressive UI**, **WCAG 2.2 Level AA accessibility verification**, and **zero-PII telemetry**. Every business rule, classification heuristic, descending Horizon bar calculation, scarcity gate, and color-contrast formula is isolated inside stateless domain engines with zero framework or Android `Context` dependencies.

### 1.1 Web & Backend Stack (`web/` + `backend/`)

| Layer | Technology / Library | Version / Target | Architectural Role & Rationale |
| :--- | :--- | :--- | :--- |
| **Backend Language & Runtime** | Java 21 (OpenJDK Toolchain) | Java `21` | Records, sealed interfaces (`PinDecision`, `TriageAction`), pattern-matching `switch` expressions, and virtual-thread-ready runtime. |
| **Backend Framework** | Spring Boot 4 (`spring-boot-starter-webmvc`, `validation`, `actuator`) | `4.0.9` / Gradle `8.14.2` | Stateless REST API (`/api/v1/pulse/*`), Jakarta Bean Validation, and Actuator health endpoints. |
| **Backend Testing** | JUnit 5 + Spring `MockMvc` | Spring Boot `4.0.9` | Fast JVM unit tests for pure Java 21 engines + ephemeral `MockMvc` HTTP contract verification. |
| **Frontend Framework** | Angular 21 Standalone Signals | `21.2.26` / TypeScript `5.9` | Fine-grained reactivity (`signal()`, `computed()`), modern control flow (`@if`, `@for`, `@switch`), and standalone components. |
| **Frontend Styling & A11y** | Material 3 Expressive CSS Tokens (`styles.css`) | WCAG 2.2 AA (`>= 4.5:1`) | Organic Sage & Warm Amber Terracotta Light/Dark CSS custom properties audited by `WcagContrastEngine`. |
| **Frontend Testing** | Vitest 4 | `4.1.12` | Fast unit and component-state verification for domain rules, visual dashboard state, and contrast ratios. |

### 1.2 Native Android Stack (`app/`)

| Layer | Technology / Library | Version / Target | Architectural Role & Rationale |
| :--- | :--- | :--- | :--- |
| **Language & Runtime** | Kotlin + Coroutines / Flow | `2.0.21` / JVM `17` | Strict null-safety, immutable state models, and reactive `StateFlow` pipelines. |
| **UI Framework** | Jetpack Compose + Material 3 | BOM `2024.10.01` | Declarative UI, `HorizontalPager` swipeable carousels, and Dynamic Color. |
| **Local Persistence** | AndroidX Room + DataStore | `2.6.1` / `1.1.1` | Offline-first SQLite task storage with reactive `Flow` queries. |
| **Networking & Sync** | Retrofit 2 + OkHttp 4 | `2.11.0` / `4.12.0` | REST client for Google Tasks API v1 (`tasks.googleapis.com/tasks/v1`). |
| **Authentication** | Play Services Auth | `21.2.0` | Native `GoogleAuthUtil` OAuth2 token acquisition (`https://www.googleapis.com/auth/tasks`). |
| **Observability** | Firebase Crashlytics + Timber | BOM `33.5.1` / `5.0.1` | Non-fatal exception reporting and PII-scrubbed breadcrumb trails. |

---

## 2. Need-to-Know Cloud, OAuth & Zero-PII Observability Configuration

- **GCP Project ID**: `gw-cli-490302` (`Project Number: 57027711654`)
- **Application Package Name**: `com.pulse.accountability`
- **Firebase Android App ID**: `1:57027711654:android:f263696af8fb2c7cdada67`
- **Local Debug Keystore SHA-1**: `B5:C2:92:ED:7B:F6:BC:30:C1:0F:F3:69:28:75:96:3B:17:B0:BF:E9`
- **Required Google OAuth Scope**: `https://www.googleapis.com/auth/tasks`
- **GitHub Monorepo Target**: `https://github.com/Stefs-Startup/monorepo` (`apps/pulse/` on branch `feat/pulse-angular-springboot`, PR `#53`)

**Zero-PII Privacy Guarantee**: `PulseObservability.scrubSensitiveText()` strips all email addresses and OAuth Bearer tokens (`Bearer ...`, `ya29....`) before any breadcrumb or non-fatal exception is recorded. User identifiers are hashed using SHA-256 via `PulseObservability.pseudonymizeIdentifier()`.

---

## 3. Developer Build, Test Pyramid & Runbook

### 3.1 Spring Boot 4 + Java 21 Backend (`backend/`)
```bash
# Run Tier 1 (Pure Unit) + Tier 2 (MockMvc Contract) tests
cd backend && ./gradlew test

# Start Spring Boot 4 server on http://localhost:8080
cd backend && ./gradlew bootRun
```

### 3.2 Angular 21 Visual Focus Dashboard (`web/`)
```bash
# Run Tier 1 (Domain/WCAG) + Tier 2 (Visual Dashboard Component/State) Vitest suite
cd web && npm test

# Build production bundle
cd web && npm run build

# Start Angular 21 dev server on http://localhost:4200 (proxying /api -> http://localhost:8080)
cd web && npm start
```

### 3.3 Native Android App (`app/`)
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
./gradlew testDebugUnitTest assembleDebug
```

---

## 4. Canonical Knowledge Sources & Repository Map

| Source / Artifact | Repository Path | Purpose & Contents |
| :--- | :--- | :--- |
| **Engineering Constitution** | [`AGENTS.md`](../../AGENTS.md) | Epic-Stream planning rules, incremental UAT gates, pure-function rules, Test Pyramid, and WCAG 2.2 AA gate. |
| **Epic Stream Roadmap & Use Cases** | [`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](../SPRINT_ROADMAP_AND_USE_CASES.md) | User-facing Epic Streams (`EPIC-1`..`EPIC-5`), Prime Use Cases (`UC-1`..`UC-5`), and internal ticket queue (`TKT-xxx`). |
| **Living UX & Interaction Spec** | [`docs/UX_FLOW_AND_DESIGN_SYSTEM.md`](../UX_FLOW_AND_DESIGN_SYSTEM.md) | Updated Mermaid interaction diagram for the Visual Focus Dashboard and WCAG 2.2 AA contrast table. |
| **Versioned Changelog** | [`docs/CHANGELOG.md`](../CHANGELOG.md) | Lockstep version history mapped to Git commits and Prime Use Cases. |
| **State Debrief & Test Report** | [`docs/tech-docs/FULL_STATE_DEBRIEF_AND_VERIFICATION_REPORT.md`](FULL_STATE_DEBRIEF_AND_VERIFICATION_REPORT.md) | Migrated Drive debrief covering UX evolution, readiness matrix, and 3-tier Test Pyramid. |
| **Stickiness & Ritual Spec (`EPIC-4`)** | [`docs/tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md`](STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md) | Behavioral architecture for Morning Anchor, Evening Shutdown, and habitual engagement tie-ins. |
