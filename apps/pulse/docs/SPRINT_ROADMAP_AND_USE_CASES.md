# Pulse — Sprint Roadmap, Prime Use Cases & Feedback Loop (Docs-as-Code)

> **Docs-as-Code Governance**: This document is version-controlled alongside the Kotlin source tree. **No sprint story or version release is considered Done** until its Prime Use Cases, Acceptance Criteria, Feedback Loop signals, and [`docs/CHANGELOG.md`](CHANGELOG.md) entry are updated and committed in lockstep with the code.

---

## 1. Docs-as-Code Definition of Done (Release Gate)

Every version (`v0.x.y` / Git commit increment) must pass all 5 mandatory gates before completion:

1. **Pure Functional Unit & Contract Gate**: `./gradlew testDebugUnitTest` passes 100% of pure domain, mapper, contract (`MockWebServer`), and zero-PII scrubber tests.
2. **WCAG 2.2 AA Accessibility Gate**: [`WcagContrastEngineTest.kt`](../app/src/test/java/com/pulse/accountability/ui/theme/WcagContrastEngineTest.kt) verifies `>= 4.5:1` normal text and `>= 3.0:1` UI component contrast across Light and Dark schemes.
3. **Dual-Target E2E Device Gate**: Verified on `emulator-5554` (`Resizable_Experimental`) and physical `Pixel 8 Pro` hardware with zero fatal/non-fatal crashes in logcat.
4. **Prime Use Case & Feedback Loop Verification**: The increment is validated against the 5 Prime Use Cases below and emits structured zero-PII breadcrumbs via [`PulseObservability.kt`](../app/src/main/java/com/pulse/accountability/util/PulseObservability.kt).
5. **Docs-as-Code Synchronization**:
   - [`README.md`](../README.md) reflects current architecture and run instructions.
   - [`docs/UX_FLOW_AND_DESIGN_SYSTEM.md`](UX_FLOW_AND_DESIGN_SYSTEM.md) reflects any UI/UX component or flow changes.
   - [`docs/SPRINT_ROADMAP_AND_USE_CASES.md`](SPRINT_ROADMAP_AND_USE_CASES.md) updates story status.
   - [`docs/CHANGELOG.md`](CHANGELOG.md) records the version tag, commit hash, changed files, and verified ACs.

---

## 2. Prime Use Cases (Critical User Journeys)

Pulse exists as a calm, honest accountability partner for **Google Tasks**—not a second task manager. All engineering work serves these 5 Prime Use Cases:

| ID | Prime Use Case | User Goal & Trigger | Primary Surface & Components | Deterministic Acceptance Criteria (AC) |
| :--- | :--- | :--- | :--- | :--- |
| **UC-1** | **Single-Viewport Horizon Assessment** | User opens Pulse to immediately understand their task drift without cognitive overload or scrolling through cluttered tables. | **Horizon** tab (`InteractiveHorizonHomeScreen`, [`AccountabilityHorizonCanvas.kt`](../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt)) | • Renders on a single viewport with zero top stat-box clutter.<br>• Partitions tasks into 3 swipeable `HorizontalPager` cards (*Habitually Undone*, *Long-Standing Drift*, *Committed & Active Flow*).<br>• Tasks inside every card are sorted in **strict descending order** (`#1`, `#2`, `#3`...) by stall severity. |
| **UC-2** | **Contextual Partner Reflection via FAB** | User taps a stalled task bar or the `Reflect` Extended FAB to talk through *why* a task is stuck and choose a concrete next move. | **Reflect FAB Overlay** ([`PartnerChatComponent.kt`](../app/src/main/java/com/pulse/accountability/ui/components/chat/PartnerChatComponent.kt)) | • Launches decoupled `PartnerChatOverlay` with active task context banner.<br>• Quick-reply chips and text input append messages and auto-scroll via `rememberLazyListState()` within `<100ms`.<br>• Conversation threads persist per-task across task switches without mutating task idle timestamps. |
| **UC-3** | **Zero-Guilt Stalled Task Triage & Top-3 Scarcity** | User rescues a chronically deferred (`3x+`) or idle (`5d+`) task by shrinking it, committing it to Today's Top 3, deferring intentionally, or parking it. | **Undone Log** tab ([`StalledTaskLogCard.kt`](../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt)) & **Horizon** | • `ScarcityEngine` enforces a hard cap of `3` pinned tasks in Today's Top 3.<br>• 1-tap triage actions (*Commit to Top 3*, *Shrink to 5m*, *Defer*, *Complete*) update Room state immediately and emit `PulseObservability` breadcrumbs. |
| **UC-4** | **Frictionless Native Google Tasks Sync** | User connects their Google account in 1 tap and syncs real Google Tasks lists with transparent error diagnostics if OAuth or network fails. | **Onboarding** & **Settings -> Google Tasks Sync** ([`GoogleAuthCredentialHelper.kt`](../app/src/main/java/com/pulse/accountability/data/auth/GoogleAuthCredentialHelper.kt)) | • Native system account picker + `GoogleAuthUtil.getToken()` with `oauth2:https://www.googleapis.com/auth/tasks`.<br>• Any OAuth/HTTP failure is classified by [`GoogleAuthDiagnostics.kt`](../app/src/main/java/com/pulse/accountability/data/auth/GoogleAuthDiagnostics.kt) and surfaced with actionable remediation. |
| **UC-5** | **Calm Multi-Page Partner Customization** | User tunes partner tone, ritual cadence, Google sync, or privacy diagnostics without scrolling a monolithic settings wall. | **Settings** tab ([`PartnerSettingsNavigator.kt`](../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt)) | • Clean 4-card index screen (*Partner Persona & AI*, *Google Tasks Sync*, *Cadence & Rituals*, *Privacy & Diagnostics*) with dedicated sub-pages and system Back navigation. |

---

## 3. Closed-Loop Feedback Architecture

To prevent regressions and ensure every sprint is grounded in real usage on the `Pixel 8 Pro`, Pulse operates a 4-stage continuous feedback loop:

```
[1. In-App Signals & Zero-PII Telemetry]
   • PartnerChatOverlay quick-reply selection & resolution rate (Did reflection lead to Top-3 Commit, 5m Shrink, or Completion?)
   • PulseObservability breadcrumbs (onboarding_step, oauth_result, sync_latency, chat_turn, triage_action)
   • Manual "Send Diagnostic Report Now" trigger in Settings -> Privacy & Diagnostics
          │
          ▼
[2. Automated Diagnostic Classification]
   • GoogleAuthDiagnostics & HTTP contract classifiers bucket failure modes (OAuth SHA-1 mismatch, 401 token expiry, 429 rate limit)
   • UI regressions caught via dual-device visual inspection (emulator-5554 + Pixel 8 Pro)
          │
          ▼
[3. Docs-as-Code Triage & Sprint Backlog Refinement]
   • Friction points are logged against Prime Use Cases (UC-1..UC-5) in docs/SPRINT_ROADMAP_AND_USE_CASES.md
   • Every bug or UX critique converts into a pure unit/contract test + deterministic AC before code changes begin
          │
          ▼
[4. Versioned Release & Changelog Verification]
   • Code + Tests + Docs committed atomically and recorded in docs/CHANGELOG.md
```

---

## 4. Multi-Sprint Plan & Backlog

### Baseline Completed: Sprint 0 — Foundation, Horizon Carousel & Modular UI (`v0.5.0` / Commit `1508793`)
- [x] **S0-1**: Pure domain engines (`UndoneAccountabilityEngine`, `ScarcityEngine`, `TaskVisualAnalyticsEngine`, `WcagContrastEngine`).
- [x] **S0-2**: Single-viewport 3-window swipeable `HorizontalPager` Horizon Carousel in strict descending order (`UC-1`).
- [x] **S0-3**: Decoupled, swappable [`PartnerChatComponent.kt`](../app/src/main/java/com/pulse/accountability/ui/components/chat/PartnerChatComponent.kt) routed via the `Reflect` FAB (`UC-2`).
- [x] **S0-4**: Reusable [`StalledTaskLogCard.kt`](../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt) in `Undone Log` (`UC-3`) and 4-page [`PartnerSettingsNavigator.kt`](../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) (`UC-5`).

### Completed: Full-Stack Web & API Increment — Angular 21 + Spring Boot 4 (`v0.6.0`)
- [x] **WEB-1 (`UC-1`, `UC-3`)**: Pure Java 21 domain engines (`UndoneAccountabilityEngine`, `TaskVisualAnalyticsEngine`, `ScarcityEngine`, `TriageRules`, `WcagContrastEngine`, `PulseObservability`) in `backend/` with Spring Boot `4.0.9` REST endpoints (`/api/v1/pulse/*`) and JUnit 5 + `MockMvc` contract tests.
- [x] **WEB-2 (`UC-1`, `UC-2`, `UC-3`, `UC-5`)**: Angular `21.2.26` standalone signals SPA in `web/` implementing the Material 3 Expressive `Horizon`, `Reflect` Partner Chat Overlay, `Undone Log`, and 4-card `Settings` navigator with Vitest unit & WCAG 2.2 AA verification.

---

### Sprint 1 — Live AI Partner & Two-Way Google Tasks Write-Back (`Target: v0.6.0`)
**Sprint Goal**: Upgrade the FAB Partner Chat from deterministic heuristics to live streaming AI coaching (with instant fallback) and make local triage mutations write back to Google Tasks API v1 reliably.

| Story ID | Prime Use Case | Story Description | Deterministic Acceptance Criteria (AC) |
| :--- | :--- | :--- | :--- |
| **S1-1** | `UC-2` | **Pluggable `PartnerChatEngine` Interface & Gemini 2.5 Flash Adapter** | 1. Define a pure `PartnerChatEngine` interface consumed by `PulseViewModel` so heuristic, cloud (`Gemini 2.5 Flash`), or on-device (`LiteRT-LM`) backends swap with zero changes to [`PartnerChatComponent.kt`](../app/src/main/java/com/pulse/accountability/ui/components/chat/PartnerChatComponent.kt).<br>2. Contract test (`MockWebServer`) verifies streaming/REST response parsing, timeout handling, and automatic fallback to `HeuristicPartnerChatEngine` when offline or unconfigured.<br>3. Update `docs/CHANGELOG.md` and `docs/UX_FLOW_AND_DESIGN_SYSTEM.md`. |
| **S1-2** | `UC-2` | **Persistent Room Chat Threads & Reflection Outcome Tagging** | 1. Persist `ConversationMessage` threads in Room (`PulseDatabase`) keyed by `taskId` so reflections survive app restarts.<br>2. Record explicit feedback outcome tags (`COMMITTED_TOP_3`, `SHRUNK_5M`, `DEFERRED`, `DISMISSED`) via `PulseObservability.recordBreadcrumb()` when a chat session concludes.<br>3. Unit tests verify thread persistence and zero-PII breadcrumb scrubbing. |
| **S1-3** | `UC-3`, `UC-4` | **Two-Way Google Tasks Write-Back & Offline Sync Queue** | 1. Completing a task, deferring a due date, or shrinking a task into a 5-minute starter step queues a `PATCH`/`POST` mutation to `tasks.googleapis.com/tasks/v1` via [`GoogleTasksApiClient.kt`](../app/src/main/java/com/pulse/accountability/data/remote/GoogleTasksApiClient.kt).<br>2. `MockWebServer` contract tests verify `200 OK`, `401 Unauthorized` token refresh retry, and offline queue replay.<br>3. Verified end-to-end on `Pixel 8 Pro` against live Google Tasks. |

---

### Sprint 2 — Proactive Ritual Cadence, In-App Feedback Loop & CI/CD (`Target: v0.7.0`)
**Sprint Goal**: Close the daily accountability loop with scheduled notifications, background sync, an in-app partner helpfulness feedback signal, and automated GitHub Actions CI.

| Story ID | Prime Use Case | Story Description | Deterministic Acceptance Criteria (AC) |
| :--- | :--- | :--- | :--- |
| **S2-1** | `UC-4`, `UC-5` | **WorkManager Periodic Sync & Ritual Notification Scheduler** | 1. Schedule periodic background Google Tasks sync and Morning Anchor / Evening Shutdown notifications based on user preferences in `Settings -> Cadence & Rituals`.<br>2. Tapping a notification deep-links directly into the `PartnerChatOverlay` focused on the `#1` Habitually Undone task.<br>3. Unit tests verify pure schedule calculation and quiet-hours suppression. |
| **S2-2** | `UC-2`, `UC-5` | **In-App Partner Feedback Loop (Thumbs Up/Down + Friction Tag)** | 1. Add lightweight, non-intrusive feedback controls on partner reflection turns (`Helpful` / `Missed the mark` with 1-tap reason chip: *Too wordy*, *Wrong tone*, *Not actionable*).<br>2. Aggregate feedback locally in Room to automatically adjust default partner prompt parameters and surface summary counts in `Settings -> Privacy & Diagnostics`.<br>3. Pure unit tests verify feedback-to-prompt adaptation logic. |
| **S2-3** | `All UCs` | **GitHub Actions CI & Docs-as-Code Linter (`Stef-Startup`)** | 1. After explicit user confirmation, configure `.github/workflows/ci.yml` to run `./gradlew testDebugUnitTest` (including `WcagContrastEngineTest`) on every PR/push.<br>2. Add a CI check verifying that `docs/CHANGELOG.md` is updated whenever files under `app/src/main/` change. |
