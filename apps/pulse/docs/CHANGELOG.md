# Pulse — Versioned Changelog (Docs-as-Code)

All notable architectural, UX, and domain changes to **Pulse** are tracked in this file. Per [`AGENTS.md`](../AGENTS.md), updating this changelog and the corresponding docs in `docs/` is a mandatory Acceptance Criterion for considering any version or increment **Done**.

---

## [`v0.6.3` — Transition Angular 21 + Spring Boot 4 to Experimental & Adopt KMP + Compose Multiplatform Web Strategy (`ADR-008`)] — 2026-11-08
- **Experimental Stack Archive (`web/` & `backend/`)**:
  - Marked the Angular 21 (`web/`) and Spring Boot 4 / Java 21 (`backend/`) directories as an **Experimental Archive (`v0.6.0–v0.6.2`)** in [`README.md`](../README.md), [`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](SPRINT_ROADMAP_AND_USE_CASES.md), and [`docs/tech-docs/TECH_STACK_RUNBOOK_AND_KNOWLEDGE_SOURCES.md`](tech-docs/TECH_STACK_RUNBOOK_AND_KNOWLEDGE_SOURCES.md), and merged the snapshot into `Stefs-Startup/monorepo` (`apps/pulse/`).
- **Primary Multiplatform Strategy (`ADR-008` — Kotlin Multiplatform + Compose Multiplatform `wasmJs`)**:
  - Pivoted `EPIC-1`..`EPIC-5` in [`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](SPRINT_ROADMAP_AND_USE_CASES.md) to **Kotlin Multiplatform (`commonMain`, `androidMain`, `wasmJsMain`) + Compose Multiplatform**, reusing ~95% of the native Kotlin domain engines (`UndoneAccountabilityEngine.kt`, `TaskVisualAnalyticsEngine.kt`, `ScarcityEngine.kt`, `TriageRules.kt`, `RitualGateRules.kt`, `WcagContrastEngine.kt`) and Jetpack Compose Material 3 Expressive UI (`AccountabilityHorizonCanvas.kt`, `StalledTaskLogCard.kt`, `PartnerSettingsNavigator.kt`, `PulseExpressiveTheme.kt`) directly in the browser.

---

## [`v0.6.2` — Visual Focus Dashboard First (`EPIC-1`), Stickiness & Ritual Architecture (`EPIC-4`), Drive-to-Markdown Migration & Full Test Pyramid] — 2026-11-08
- **Visual Focus Dashboard Only (`EPIC-1` UAT Focus)**:
  - Updated [`app.component.ts`](../web/src/app/app.component.ts) and [`stalled-task-card.component.ts`](../web/src/app/components/stalled-task-card/stalled-task-card.component.ts) to focus 100% on the **Visual Focus Dashboard** (`Horizon` 3-window descending bars `#1`, `#2`, `#3`..., Today's Top 3 Scarcity Strip, Selected Node Inspector with 5 direct visual triage buttons, `Undone Log`, and 4-card `Settings` navigator), saving Conversational Partner Chat for `EPIC-5`.
- **`EPIC-4` Reframed Around App Stickiness, Daily Ritual Loops & Habitual Tie-Ins**:
  - Updated [`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](SPRINT_ROADMAP_AND_USE_CASES.md) and authored [`docs/tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md`](tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md) specifying the Morning Anchor (`08:30`), Evening Honest Shutdown (`18:00`), Implementation Intentions (`"If-Then"` 5m starter cues), and Rolling 7-Day Zero-Guilt Consistency Pulse.
- **Updated Interaction Diagram & Google Drive Docs Migration (`docs/tech-docs/`)**:
  - Updated the Mermaid interaction diagram in [`docs/UX_FLOW_AND_DESIGN_SYSTEM.md`](UX_FLOW_AND_DESIGN_SYSTEM.md) to reflect the pure Visual Focus Dashboard + Ritual Stickiness loop.
  - Migrated Google Drive technical documents (`1HOPr0cj2NqOZrRwHn0j-k8rfi8vZonUrk0uQB9PQtaE` and `1Fz7vE46pcEZmPEuPn71tMpQcLeg_vIry6DJNUhRMlgg`) into version-controlled Markdown under `docs/tech-docs/`: [`FULL_STATE_DEBRIEF_AND_VERIFICATION_REPORT.md`](tech-docs/FULL_STATE_DEBRIEF_AND_VERIFICATION_REPORT.md) and [`TECH_STACK_RUNBOOK_AND_KNOWLEDGE_SOURCES.md`](tech-docs/TECH_STACK_RUNBOOK_AND_KNOWLEDGE_SOURCES.md).
- **Full 3-Tier Test Pyramid Verification**:
  - **Tier 1 (Pure Unit)**: JUnit 5 (`backend`), Vitest (`pulse-domain.engine.spec.ts`), and JUnit 4 (`app`).
  - **Tier 2 (Component & HTTP Contract)**: Added [`pulse-visual-dashboard.spec.ts`](../web/src/app/pulse-visual-dashboard.spec.ts) (4/4 component & state contract tests) and expanded [`PulseControllerContractTest.java`](../backend/src/test/java/com/pulse/backend/api/PulseControllerContractTest.java) (`MockMvc` descending window order, Top-3 swap execution, 5m shrink, settings update, and 404 error contract).
  - **Tier 3 (Live E2E)**: Verified live Angular 21 (`http://localhost:4200`) + Spring Boot 4 (`http://localhost:8080`) end-to-end.

---

## [`v0.6.1` — Epic-Stream Planning Governance & Live Website E2E Verification] — 2026-11-08
- **Planning & Governance ([`AGENTS.md`](../AGENTS.md), [`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](SPRINT_ROADMAP_AND_USE_CASES.md))**:
  - Updated Section 1 of `AGENTS.md` and restructured `docs/SPRINT_ROADMAP_AND_USE_CASES.md` so the user is presented strictly with high-level **Epic Streams (`EPIC-1`..`EPIC-4`)** and UAT checkpoints, while the agent self-organizes compartmentalized technical tickets (`TKT-101`..`TKT-402`) internally.
- **Website Testing (`web/` & `backend/`)**:
  - Expanded [`pulse-domain.engine.spec.ts`](../web/src/app/domain/pulse-domain.engine.spec.ts) (5/5 Vitest tests passing) alongside JUnit 5 + `MockMvc` backend tests (6/6 test suites passing).
  - Verified live Angular 21 (`http://localhost:4200`) + Spring Boot 4 (`http://localhost:8080`) end-to-end proxy, 3-window Horizon ordering, Top-3 scarcity gate, `Reflect` chat reply generation, and 18/18 WCAG 2.2 AA contrast pairs.

---

## [`v0.6.0` — Full-Stack Angular 21 + Spring Boot 4 (Java 21) Web & API Companion] — 2026-11-07
- **Prime Use Cases**: `UC-1` (Single-Viewport Horizon Assessment), `UC-2` (Contextual Partner Reflection via FAB), `UC-3` (Zero-Guilt Stalled Task Triage & Top-3 Scarcity), `UC-5` (Calm Multi-Page Partner Customization), WCAG 2.2 AA Accessibility Gate
- **Spring Boot 4.0.9 + Java 21 Backend (`backend/`)**:
  - Ported pure functional domain & observability core to Java 21 records, sealed interfaces, and pattern-matching switch expressions: [`UndoneAccountabilityEngine.java`](../backend/src/main/java/com/pulse/backend/domain/UndoneAccountabilityEngine.java), [`TaskVisualAnalyticsEngine.java`](../backend/src/main/java/com/pulse/backend/domain/TaskVisualAnalyticsEngine.java), [`ScarcityEngine.java`](../backend/src/main/java/com/pulse/backend/domain/ScarcityEngine.java), [`TriageRules.java`](../backend/src/main/java/com/pulse/backend/domain/TriageRules.java), [`WcagContrastEngine.java`](../backend/src/main/java/com/pulse/backend/domain/WcagContrastEngine.java), and [`PulseObservability.java`](../backend/src/main/java/com/pulse/backend/observability/PulseObservability.java).
  - Created [`PulseAccountabilityService.java`](../backend/src/main/java/com/pulse/backend/service/PulseAccountabilityService.java) and [`PulseController.java`](../backend/src/main/java/com/pulse/backend/api/PulseController.java) exposing `/api/v1/pulse/state`, `/tasks/{taskId}/triage`, `/tasks/swap`, `/tasks/{taskId}/chat`, `/settings`, and `/demo/reset`.
- **Angular 21.2.26 Standalone Signals SPA (`web/`)**:
  - Created [`app.component.ts`](../web/src/app/app.component.ts), [`pulse-state.service.ts`](../web/src/app/services/pulse-state.service.ts), [`partner-chat-overlay.component.ts`](../web/src/app/components/partner-chat/partner-chat-overlay.component.ts), [`stalled-task-card.component.ts`](../web/src/app/components/stalled-task-card/stalled-task-card.component.ts), and [`settings-navigator.component.ts`](../web/src/app/components/settings-navigator/settings-navigator.component.ts) with Material 3 Expressive Light/Dark CSS tokens (`styles.css`).
- **Verification**:
  - `cd backend && ./gradlew test`: 6/6 JUnit 5 + Spring `MockMvc` test suites passing.
  - `cd web && npm test && npm run build`: 4/4 Vitest unit & WCAG 2.2 AA tests passing + clean Angular 21 production build.

---

## [`v0.5.1` — Docs-as-Code Governance, Sprint Roadmap & Prime Use Cases] — 2026-11-06
- **Governance & Release Gate ([`AGENTS.md`](../AGENTS.md))**:
  - Added **Mandatory Docs-as-Code Release Gate** and **Continuous Feedback Loop Integration** to Section 1 and Section 5.
- **Sprint Planning & Use Case Architecture ([`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](SPRINT_ROADMAP_AND_USE_CASES.md))**:
  - Formalized the 5 Prime Use Cases (`UC-1` Single-Viewport Horizon Assessment, `UC-2` Contextual Partner Reflection via FAB, `UC-3` Zero-Guilt Stalled Task Triage & Top-3 Scarcity, `UC-4` Frictionless Native Google Tasks Sync, `UC-5` Calm Multi-Page Partner Customization).
  - Defined the 4-stage Closed-Loop Feedback Architecture connecting in-app reflection outcomes and zero-PII telemetry to sprint backlog refinement.
  - Structured **Sprint 1 (`v0.6.0`)** and **Sprint 2 (`v0.7.0`)** stories (`S1-1`..`S2-3`) with deterministic Acceptance Criteria.
- **Repository Entrypoint ([`README.md`](../README.md))**:
  - Synchronized `README.md` with the current 3-tab Material 3 navigation (`Horizon`, `Undone Log`, `Settings`), swipeable `HorizontalPager` Horizon Carousel, decoupled `PartnerChatComponent`, and Docs-as-Code workflow.

---

## [`v0.5.0` — Multi-Page Settings Navigator] — Commit `1508793` (2026-11-05)
- **Prime Use Case**: `UC-5` (Calm Multi-Page Partner Customization)
- **Changes**:
  - Created [`PartnerSettingsNavigator.kt`](../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) splitting the monolithic Settings screen into a 4-card index (*Partner Persona & AI*, *Google Tasks Sync*, *Cadence & Rituals*, *Privacy & Diagnostics*) with animated sub-pages and `BackHandler` support.
  - Removed 890 lines of dead legacy UI code from [`PulseScreens.kt`](../app/src/main/java/com/pulse/accountability/ui/screens/PulseScreens.kt).
- **Verification**: `./gradlew testDebugUnitTest` passed; verified on `emulator-5554` and `Pixel 8 Pro`.

---

## [`v0.4.2` — Single-Viewport Clean Horizon] — Commit `c8a3eb1` (2026-11-05)
- **Prime Use Case**: `UC-1` (Single-Viewport Horizon Assessment)
- **Changes**:
  - Removed top stat boxes (*Avg Deferral*, *Oldest Loop*, *Clarity Ratio*) and below-the-fold duplicate task list from `InteractiveHorizonHomeScreen` in [`PulseScreens.kt`](../app/src/main/java/com/pulse/accountability/ui/screens/PulseScreens.kt) and [`AccountabilityHorizonCanvas.kt`](../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt).
- **Verification**: Full Horizon card and Top-3 strip fit on a single screen without scrolling on `emulator-5554` and `Pixel 8 Pro`.

---

## [`v0.4.1` — Swipeable 3-Window Horizon Carousel in Descending Order] — Commit `0a8f2cb` (2026-11-05)
- **Prime Use Case**: `UC-1` (Single-Viewport Horizon Assessment)
- **Changes**:
  - Updated [`TaskVisualAnalyticsEngine.kt`](../app/src/main/java/com/pulse/accountability/domain/TaskVisualAnalyticsEngine.kt) to partition tasks into 3 distinct `HorizonWindowCardModel` buckets (*Habitually Undone*, *Long-Standing Drift*, *Committed & Active Flow*) sorted in strict descending order (`#1`, `#2`, `#3`...).
  - Updated [`AccountabilityHorizonCanvas.kt`](../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt) to render a swipeable Material 3 `HorizontalPager` with proportional analytical bars.
- **Verification**: [`TaskVisualAnalyticsEngineTest.kt`](../app/src/test/java/com/pulse/accountability/domain/TaskVisualAnalyticsEngineTest.kt) (4/4 tests passing).

---

## [`v0.4.0` — Modular Reactive Partner Chat & Reusable Stalled Task Card] — Commit `74c8d6b` (2026-11-05)
- **Prime Use Cases**: `UC-2` (Contextual Partner Reflection via FAB), `UC-3` (Zero-Guilt Stalled Task Triage)
- **Changes**:
  - Extracted [`PartnerChatComponent.kt`](../app/src/main/java/com/pulse/accountability/ui/components/chat/PartnerChatComponent.kt) (`PartnerChatOverlay`, `PartnerChatContent`, `PartnerChatMapper`, `PartnerChatUiModel`) with `rememberLazyListState()` auto-scrolling and `imePadding()`.
  - Updated [`PulseViewModel.kt`](../app/src/main/java/com/pulse/accountability/ui/viewmodel/PulseViewModel.kt) to persist per-task conversation threads (`conversationThreadsByTaskId`) and preserve task idle timestamps during chat turns.
  - Extracted [`StalledTaskLogCard.kt`](../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt) for the `Undone Log`.
- **Verification**: [`PartnerChatMapperTest.kt`](../app/src/test/java/com/pulse/accountability/ui/components/chat/PartnerChatMapperTest.kt) (5/5 tests passing) + E2E verification on `Pixel 8 Pro`.

---

## [`v0.3.0` — Interactive Horizon Analytics, FAB Chat Routing & WCAG 2.2 AA Gate] — Commit `df8a2b1` (2026-11-05)
- **Prime Use Cases**: `UC-1`, `UC-2`, Accessibility Gate
- **Changes**:
  - Added [`WcagContrastEngine.kt`](../app/src/main/java/com/pulse/accountability/ui/theme/WcagContrastEngine.kt) and [`WcagContrastEngineTest.kt`](../app/src/test/java/com/pulse/accountability/ui/theme/WcagContrastEngineTest.kt) enforcing `>= 4.5:1` contrast ratios across Light and Dark themes.
  - Created [`docs/UX_FLOW_AND_DESIGN_SYSTEM.md`](UX_FLOW_AND_DESIGN_SYSTEM.md).
