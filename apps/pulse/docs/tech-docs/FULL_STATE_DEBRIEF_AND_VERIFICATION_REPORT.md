# Pulse — Full State Debrief, UX Evolution & Verification Report

> **Docs-as-Code Provenance**: Migrated from Google Drive (`1HOPr0cj2NqOZrRwHn0j-k8rfi8vZonUrk0uQB9PQtaE`) into version-controlled `docs/tech-docs/` and updated for **`v0.6.2` (Visual Focus Dashboard + Full Test Pyramid across Angular 21, Spring Boot 4 / Java 21, and Android)**.

---

## 1. Product & UX Evolution Debrief

During initial prototyping, too many secondary features (weekly goals, task creation forms, oversized headers, and chat overlays) competed for attention. Through iterative pairing, Pulse was refined around a strict **Visual Focus Dashboard First (`EPIC-1`)** philosophy:

1. **Visual Focus Dashboard Only for Initial UAT (`v0.6.2`)**:
   - The primary application commits 100% to the visual analytical dashboard (`Horizon`, `Undone Log`, `Settings`).
   - Conversational Partner Chat (`Reflect` FAB / chat drawer) is parked for a future milestone (`EPIC-5`) so users can evaluate and accept the visual focus workflow with zero chat distraction.
2. **Header & Navigation Restraint**:
   - Replaced oversized headers and app-name vanity branding (`"Pulse • Accountability"`) with a compact `64px` / `64.dp` Material 3 `TopAppBar` and a standard 3-destination bottom `NavigationBar` (`Horizon`, `Undone Log`, `Settings`).
   - Removed redundant `"Commit Task"` creation FABs since tasks originate in Google Tasks.
3. **3-Window Horizon Dashboard in Strict Descending Order (`#1`, `#2`, `#3`...)**:
   - Open tasks are partitioned into 3 analytical windows (*Habitually Undone*, *Long-Standing Drift*, *Committed & Active Flow*), each sorted strictly in descending order of stall severity (`#1`, `#2`, `#3`...) with proportional visual bars and a synchronized **Selected Task Inspector Card**.
4. **3-Slot Today's Top 3 Scarcity Gate**:
   - Enforces a hard cap of `3` daily commitments (`ScarcityEngine`). Attempting to pin a 4th task triggers an explicit **Top-3 Swap Modal** so daily focus stays honest.
5. **Multi-Page Categorized Settings Navigator**:
   - Split the settings screen into 4 dedicated category cards (*Partner Persona & AI*, *Google Tasks Sync*, *Cadence & Rituals*, *Privacy & Diagnostics*) with sub-page drill-down and live WCAG 2.2 AA / zero-PII breadcrumb inspection.

---

## 2. State of Engineering Readiness & Multi-Platform Matrix (`v0.6.2`)

| Subsystem / Capability | Status | Web & API (`web/` + `backend/`) | Android (`app/`) | Verification Proof |
| :--- | :--- | :--- | :--- | :--- |
| **3-Window Descending Horizon (`UC-1`)** | Verified | [`app.component.ts`](../../web/src/app/app.component.ts), [`TaskVisualAnalyticsEngine.java`](../../backend/src/main/java/com/pulse/backend/domain/TaskVisualAnalyticsEngine.java) | [`AccountabilityHorizonCanvas.kt`](../../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt), [`TaskVisualAnalyticsEngine.kt`](../../app/src/main/java/com/pulse/accountability/domain/TaskVisualAnalyticsEngine.kt) | JUnit 5, Vitest, JUnit 4 + Live `:4200` E2E |
| **Top-3 Scarcity Gate & Visual Triage (`UC-2`)** | Verified | [`ScarcityEngine.java`](../../backend/src/main/java/com/pulse/backend/domain/ScarcityEngine.java), [`TriageRules.java`](../../backend/src/main/java/com/pulse/backend/domain/TriageRules.java), [`stalled-task-card.component.ts`](../../web/src/app/components/stalled-task-card/stalled-task-card.component.ts) | [`ScarcityEngine.kt`](../../app/src/main/java/com/pulse/accountability/domain/ScarcityEngine.kt), [`TriageRules.kt`](../../app/src/main/java/com/pulse/accountability/domain/TriageRules.kt), [`StalledTaskLogCard.kt`](../../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt) | Unit + `MockMvc` swap gate contract tests |
| **WCAG 2.2 AA Contrast Audit** | Verified | [`WcagContrastEngine.java`](../../backend/src/main/java/com/pulse/backend/domain/WcagContrastEngine.java), [`pulse-domain.engine.ts`](../../web/src/app/domain/pulse-domain.engine.ts) | [`WcagContrastEngine.kt`](../../app/src/main/java/com/pulse/accountability/ui/theme/WcagContrastEngine.kt), [`PulseExpressiveTheme.kt`](../../app/src/main/java/com/pulse/accountability/ui/theme/PulseExpressiveTheme.kt) | 100% of Light & Dark pairs `>= 4.5:1` |
| **Zero-PII Telemetry & Scrubbing** | Verified | [`PulseObservability.java`](../../backend/src/main/java/com/pulse/backend/observability/PulseObservability.java) | [`PulseObservability.kt`](../../app/src/main/java/com/pulse/accountability/observability/PulseObservability.kt) | Regex email/token scrubbing + SHA-256 hashing tests |
| **4-Card Settings Navigator (`UC-4`)** | Verified | [`settings-navigator.component.ts`](../../web/src/app/components/settings-navigator/settings-navigator.component.ts) | [`PartnerSettingsNavigator.kt`](../../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) | Component navigation + settings PUT contract tests |
| **Google OAuth & Tasks Sync (`UC-3`)** | Verified on Android / Seeded on Web | [`PulseAccountabilityService.java`](../../backend/src/main/java/com/pulse/backend/service/PulseAccountabilityService.java) | [`GoogleTasksApiClient.kt`](../../app/src/main/java/com/pulse/accountability/data/remote/GoogleTasksApiClient.kt), [`GoogleAuthDiagnostics.kt`](../../app/src/main/java/com/pulse/accountability/observability/GoogleAuthDiagnostics.kt) | `MockWebServer` 200/401/403 + `Pixel 8 Pro` |

---

## 3. Full Test Pyramid Verification Matrix

Per Section 2 of [`AGENTS.md`](../../AGENTS.md), Pulse enforces a 3-tier test pyramid across all stacks:

### Tier 1 — Pure Functional Unit Tests (Zero Framework/Context Dependencies)
- **Spring Boot 4 / Java 21 (`backend/src/test/java/com/pulse/backend/domain/`)**:
  - [`UndoneAccountabilityEngineTest.java`](../../backend/src/test/java/com/pulse/backend/domain/UndoneAccountabilityEngineTest.java): Verifies `HABITUALLY_DEFERRED` (`2x+`), `LONG_STANDING_GHOSTED` (`5d+` idle / overdue), and `ACTIVE_COMMITTED` classification.
  - [`TaskVisualAnalyticsEngineTest.java`](../../backend/src/test/java/com/pulse/backend/domain/TaskVisualAnalyticsEngineTest.java): Verifies 3-window Horizon partitioning and strict descending sort order (`#1 -> #2 -> #3`).
  - [`ScarcityEngineTest.java`](../../backend/src/test/java/com/pulse/backend/domain/ScarcityEngineTest.java): Verifies 3-slot Today's Top 3 cap and swap execution.
  - [`WcagContrastEngineTest.java`](../../backend/src/test/java/com/pulse/backend/domain/WcagContrastEngineTest.java): Verifies all 18 Light & Dark Material 3 Expressive pairs pass `>= 4.5:1`.
  - [`PulseObservabilityTest.java`](../../backend/src/test/java/com/pulse/backend/observability/PulseObservabilityTest.java): Verifies email/Bearer token redaction and deterministic SHA-256 pseudonymization.
- **Angular 21 (`web/src/app/domain/pulse-domain.engine.spec.ts`)**:
  - Verifies pure TypeScript WCAG 2.2 AA contrast mathematics, PII scrubbing, descending bar order invariants, and Top-3 scarcity decisions.
- **Android JVM (`app/src/test/java/com/pulse/accountability/`)**:
  - `UndoneAccountabilityEngineTest`, `TaskVisualAnalyticsEngineTest`, `ScarcityEngineTest`, `TriageRulesTest`, `RitualGateRulesTest`, `WcagContrastEngineTest`, `GoogleAuthDiagnosticsTest`, `PulseObservabilityTest`.

### Tier 2 — Component & API Integration / Contract Tests
- **Spring Boot `MockMvc` Contract Suite ([`PulseControllerContractTest.java`](../../backend/src/test/java/com/pulse/backend/api/PulseControllerContractTest.java))**:
  - Verifies `GET /api/v1/pulse/state`, `POST /api/v1/pulse/tasks/{id}/triage` (`COMMIT_TODAY`, `SHRINK_TO_5M`, `RESCHEDULE`, `PARK_SOMEDAY`, `COMPLETE`), `POST /api/v1/pulse/tasks/swap`, `PUT /api/v1/pulse/settings`, and HTTP `400`/`404` error contracts.
- **Angular 21 Visual Dashboard Component & State Suite ([`pulse-visual-dashboard.spec.ts`](../../web/src/app/pulse-visual-dashboard.spec.ts))**:
  - Verifies that the Visual Focus Dashboard renders the 3 Horizon windows, Top-3 scarcity slots, Selected Node Inspector, `Undone Log` cards, and 4-card `Settings` navigator with zero chat FAB clutter.
- **Android `MockWebServer` Contract Suite ([`GoogleTasksSyncContractTest.kt`](../../app/src/test/java/com/pulse/accountability/data/remote/GoogleTasksSyncContractTest.kt))**:
  - Verifies OAuth Bearer headers, JSON serialization, and HTTP `200`/`401`/`403` handling.

### Tier 3 — Live End-to-End (E2E) Verification
- **Web E2E (`http://localhost:4200` -> `http://localhost:8080`)**:
  - Live Angular 21 dev server proxying `/api/v1/pulse/*` to Spring Boot 4 on Java 21, verified end-to-end across window switching, Top-3 pinning/swapping, 5m shrinking, and demo reset.
- **Android E2E (`emulator-5554` & `Pixel 8 Pro`)**:
  - Verified via ADB instrumentation flags (`e2e_mlp_radar`, `e2e_open_settings`, `e2e_auth_error_10`).
