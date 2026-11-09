# Pulse — Epic Stream Roadmap, Prime Use Cases & Internal Agent Ticketing (Docs-as-Code)

> **Planning Governance (`AGENTS.md` §1)**:
> - **User-Facing Layer (Section 2 & Section 3)**: Product planning is presented to the user strictly as outcome-driven **Epic Streams (`EPIC-1`..`EPIC-5`)** with clear User Acceptance Testing (UAT) checkpoints.
> - **Primary Strategy (`ADR-008` — KMP + Compose Multiplatform Web & Android)**: Take the native Kotlin domain and Jetpack Compose Material 3 Expressive UI directly to the Web via **Kotlin Multiplatform (`commonMain`, `androidMain`, `wasmJsMain`)**. The Angular 21 (`web/`) + Spring Boot 4 (`backend/`) stack is preserved in the monorepo as an **Experimental Archive (`v0.6.0–v0.6.2`)**.
> - **Visual Focus First**: Initial focus commits **solely to the Visual Focus Dashboard** (`Horizon`, `Undone Log`, `Settings`). Conversational Partner Chat is intentionally deferred to `EPIC-5`.
> - **Agent-Internal Layer (Section 5)**: Low-level technical decomposition, class/API wiring, and test harnesses are self-organized by the engineering agent into compartmentalized technical tickets (`TKT-xxx`) so each slice can be reviewed and user-accepted independently.

---

## 1. Docs-as-Code Definition of Done & Test Pyramid Gate

Every compartmentalized increment (`v0.x.y` / Git commit) must pass all 5 mandatory gates before requesting User Acceptance:

1. **Test Pyramid Gate (Unit -> Integration/Contract -> E2E)**:
   - **Tier 1 (Pure Unit Tests)**: Backend JUnit 5 (`cd backend && ./gradlew test`), Web Vitest (`cd web && npm test`), and Android JUnit 4 (`./gradlew testDebugUnitTest`) cover 100% of pure domain, scarcity, contrast, and PII-scrubber functions.
   - **Tier 2 (Component & HTTP Contract Tests)**: Spring Boot `MockMvc` (`PulseControllerContractTest`), Android `MockWebServer` (`GoogleTasksSyncContractTest`), and Angular visual dashboard component/state specs verify JSON contracts, status codes (`200`, `400`, `401`, `403`, `404`), and UI state transitions.
   - **Tier 3 (Live E2E Runtime Verification)**: Verified against the live Angular 21 (`http://localhost:4200`) + Spring Boot 4 (`http://localhost:8080`) stack and/or Android targets (`emulator-5554` & `Pixel 8 Pro`).
2. **WCAG 2.2 AA Accessibility Gate**: Deterministic contrast ratio tests verify `>= 4.5:1` normal text and `>= 3.0:1` UI component contrast across Light and Dark schemes.
3. **Visual Focus Restraint Gate**: Zero chat FAB or chat drawer clutter on the initial Visual Focus Dashboard (`EPIC-1`).
4. **Prime Use Case & Zero-PII Telemetry Gate**: Validated against the Prime Use Cases below with structured zero-PII breadcrumbs (`PulseObservability`).
5. **Docs-as-Code Synchronization**: `README.md`, `docs/UX_FLOW_AND_DESIGN_SYSTEM.md`, `docs/SPRINT_ROADMAP_AND_USE_CASES.md`, `docs/CHANGELOG.md`, and `docs/tech-docs/*` updated in lockstep.

---

## 2. Executive Epic Streams (User-Facing Roadmap & UAT Checkpoints)

| Epic ID | Epic Stream | User Outcome & Value | Prime Use Cases | Current Status & User Acceptance Checkpoint |
| :--- | :--- | :--- | :--- | :--- |
| **`EPIC-1`** | **Native-Fidelity KMP Visual Focus Dashboard (Web `wasmJs` & Android)** | Run the exact native Jetpack Compose Material 3 Expressive **Visual Focus Dashboard** ([`AccountabilityHorizonCanvas.kt`](../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt), [`StalledTaskLogCard.kt`](../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt), [`PulseExpressiveTheme.kt`](../app/src/main/java/com/pulse/accountability/ui/theme/PulseExpressiveTheme.kt)) and pure Kotlin domain engines in the browser via **Compose Multiplatform (`wasmJs`)** alongside Android—with spring-animated `HorizontalPager` windows, Top-3 scarcity swap gate, and zero chat clutter. | `UC-1`, `UC-2` | **Active Priority (`v0.7.0-kmp`)** — Transitioning from experimental Angular/Spring Boot (`v0.6.2`) to shared KMP `commonMain` + `wasmJsMain`. |
| **`EPIC-2`** | **Frictionless Two-Way Google Tasks Sync (KMP `Ktor` / REST)** | Connect Google Tasks once and have every visual dashboard action (*Done*, *Shrink to 5m*, *Tomorrow*, *Park*) sync reliably back to Google Tasks API v1 across Web and Android using shared Kotlin serialization and `GoogleAuthDiagnostics`. | `UC-3` | **Queued After `EPIC-1` KMP Web UAT** — Delivered in compartmentalized slices: KMP HTTP client, write-back queue, and OAuth remediation banner. |
| **`EPIC-3`** | **Calm Multi-Page Customization & Privacy Diagnostics** | Share [`PartnerSettingsNavigator.kt`](../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) across Android and Web to configure ritual times, Google Tasks sync, and inspect live WCAG 2.2 AA contrast & zero-PII telemetry breadcrumbs. | `UC-4` | **Included in KMP UI Migration** — Native 4-card Compose Settings Navigator & live WCAG/telemetry inspector shared in `commonMain`. |
| **`EPIC-4`** | **App Stickiness, Daily Ritual Loops & Habitual Engagement Tie-Ins** | Build lasting daily engagement through behavioral habit loops in pure Kotlin: a 60-second **Morning Anchor Ritual** (locking Today's Top 3), an **Evening Honest Shutdown Ritual** (celebrating wins & triaging leftovers without guilt), **Implementation Intentions** (`"When [cue], I will start my 5m step"`), and zero-guilt **Consistency & Momentum Streaks**. | `UC-5` | **Planned (Spec Complete in [`docs/tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md`](tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md))** — Ready to execute in shared Kotlin (`commonMain`). |
| **`EPIC-5`** | **Conversational Partner Chat & Live AI Coaching (Saved for Later)** | Optional reactive chat overlay ([`PartnerChatComponent.kt`](../app/src/main/java/com/pulse/accountability/ui/components/chat/PartnerChatComponent.kt)) and streaming AI coaching once the core KMP Visual Focus Dashboard and Ritual Stickiness loops are user-accepted. | `UC-6` (Deferred) | **Saved for Later** — Intentionally decoupled and parked out of the active UI so `EPIC-1`..`EPIC-4` stay 100% focused on the visual dashboard and habitual stickiness. |

---

## 3. Prime Use Cases (Critical User Journeys)

| ID | Prime Use Case | User Goal & Trigger | Primary Surface & Components | Deterministic Acceptance Criteria (AC) |
| :--- | :--- | :--- | :--- | :--- |
| **UC-1** | **Single-Viewport Visual Horizon Assessment** | Immediately see task drift and today's focus on a single visual dashboard without scrolling cluttered tables or chat threads. | **Horizon** tab ([`app.component.ts`](../web/src/app/app.component.ts), [`AccountabilityHorizonCanvas.kt`](../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt)) | • Renders 3 analytical windows (*Habitually Undone*, *Long-Standing Drift*, *Committed & Active Flow*) in strict descending order (`#1`, `#2`, `#3`...).<br>• Selecting any bar updates the **Selected Task Inspector** immediately.<br>• Zero chat FAB or task-creation clutter. |
| **UC-2** | **Zero-Guilt Visual Triage & Top-3 Scarcity** | Rescue a chronically deferred (`2x+`) or idle (`5d+`) task in 1 tap from either the Horizon Inspector or `Undone Log`. | **Horizon Inspector** & **Undone Log** ([`stalled-task-card.component.ts`](../web/src/app/components/stalled-task-card/stalled-task-card.component.ts)) | • `ScarcityEngine` enforces a hard cap of `3` tasks in Today's Top 3 (prompting a swap modal on the 4th).<br>• 1-tap visual actions (*Pin to Top 3*, *Shrink to 5m Starter*, *Tomorrow*, *Park Someday*, *Done ✓*) update state immediately and emit zero-PII breadcrumbs. |
| **UC-3** | **Frictionless Google Tasks Sync** | Keep the Visual Focus Dashboard and Google Tasks in lockstep. | **TopAppBar Sync** & **Settings -> Google Tasks Sync** | • Syncs task lists and queues write-back mutations with actionable remediation via `GoogleAuthDiagnostics`. |
| **UC-4** | **Calm Multi-Page Customization & Diagnostics** | Tune cadence windows, sync, and inspect privacy/accessibility health without a monolithic settings wall. | **Settings** tab ([`settings-navigator.component.ts`](../web/src/app/components/settings-navigator/settings-navigator.component.ts)) | • 4-card Settings index with dedicated sub-pages and explicit Back navigation. |
| **UC-5** | **Daily Ritual Stickiness & Habitual Engagement Loop** | Form a sticky daily habit of anchoring the morning in Top 3 priorities and closing open loops each evening. | **Morning Anchor Banner**, **Evening Shutdown Flow**, & **Momentum Strip** (`EPIC-4`) | • Pure `RitualGateRules` & `HabitStreakEngine` trigger Morning Anchor / Evening Shutdown states based on local time and configured ritual windows.<br>• Tracks zero-guilt consistency streaks (`daysAnchoredThisWeek`) and 5-minute starter cue tie-ins. |

---

## 4. Closed-Loop Feedback & Stickiness Architecture

```mermaid
flowchart TD
    Cue["1. Habitual Cue\nMorning Anchor Window (08:30) or Evening Shutdown (18:00)"] --> Routine["2. Visual Focus Routine\nInspect Descending Horizon (#1..#N) & Lock Today's Top 3"]
    Routine --> Action["3. 1-Tap Visual Triage\nPin Top 3 • Shrink to 5m • Tomorrow • Park • Done"]
    Action --> Reward["4. Immediate Visual Reward\nClarity Ratio ↑ • Top-3 Slot Completed • Zero-Guilt Streak"]
    Reward --> Telemetry["5. Zero-PII Telemetry & UAT Loop\nPulseObservability Breadcrumbs Inform Next Epic Slice"]
```

---

## 5. Agent-Internal Technical Ticketing Queue (Self-Managed Compartmentalized Parts)

> *Maintained internally by the engineering agent to deliver small, isolated, user-acceptable slices.*

### Epic Stream 1 (`EPIC-1`): Native-Fidelity KMP Visual Focus Dashboard (Web `wasmJs` & Android)
- [x] **`TKT-100` (Experimental Archive — Angular 21 + Spring Boot 4)**: Preserved `web/` and `backend/` (`v0.6.0–v0.6.2`) in the monorepo as an experimental reference.
- [ ] **`TKT-101` (KMP Shared Domain Extraction — `commonMain`)**: Replace `java.time.*` / `java.util.UUID` with multiplatform `kotlinx-datetime` (`0.6.x`) and `kotlin.uuid.Uuid` across `UndoneAccountabilityEngine.kt`, `TaskVisualAnalyticsEngine.kt`, `ScarcityEngine.kt`, `TriageRules.kt`, `RitualGateRules.kt`, and `WcagContrastEngine.kt`, verified by `commonTest`.
- [ ] **`TKT-102` (Compose Multiplatform Visual Focus UI — `commonMain` & `wasmJsMain`)**: Share `PulseExpressiveTheme.kt`, `AccountabilityHorizonCanvas.kt` (spring-animated 3-window `HorizontalPager` + Top-3 Scarcity Strip + Selected Node Inspector with direct visual triage), `StalledTaskLogCard.kt`, and `PartnerSettingsNavigator.kt` across Android and Web (`wasmJs`) with zero chat FAB clutter.
- [ ] **`TKT-103` (KMP 3-Tier Test Pyramid & Live Browser UAT)**: Run `commonTest` unit tests, state/contract tests, and live `wasmJsBrowserDevelopmentRun` E2E verification.

### Epic Stream 2 (`EPIC-2`): Frictionless Two-Way Google Tasks Sync
- [ ] **`TKT-201` (Two-Way Write-Back Client & Retry Queue)**: Queue `PATCH`/`POST` mutations to Google Tasks API v1 on completion, deferral, or 5m shrink with `MockWebServer` contract tests.
- [ ] **`TKT-202` (Web & Android OAuth Connection Diagnostics)**: Surface OAuth status and 1-click reconnect guidance via `GoogleAuthDiagnostics`.

### Epic Stream 3 (`EPIC-3`): Calm Multi-Page Customization & Privacy Diagnostics
- [x] **`TKT-301` (4-Card Categorized Settings Navigator)**: `SettingsNavigatorComponent` (Web) and `PartnerSettingsNavigator` (Android) with live WCAG 2.2 AA contrast & zero-PII breadcrumb inspector.

### Epic Stream 4 (`EPIC-4`): App Stickiness, Daily Ritual Loops & Habitual Engagement Tie-Ins
- [ ] **`TKT-401` (Pure `HabitualStickinessEngine` & `RitualGateRules` Port)**: Pure Java 21 & TypeScript engine computing active ritual state (`MORNING_ANCHOR_DUE`, `FOCUS_IN_FLOW`, `EVENING_SHUTDOWN_DUE`), weekly anchor consistency (`daysAnchored / 7`), and implementation-intention prompts (`"If-Then"` 5-minute starter cues).
- [ ] **`TKT-402` (Morning Anchor & Evening Honest Shutdown Visual Banner)**: Interactive ritual card at the top of the `Horizon` dashboard that guides locking in 3 tasks each morning and reviewing/closing open loops each evening.
- [ ] **`TKT-403` (Zero-Guilt Momentum Strip & Habit Cue Tie-Ins)**: Visual momentum indicator celebrating consecutive days of honest triage (completing, shrinking, or consciously parking stalled tasks) without punitive streak-breaking guilt.

### Epic Stream 5 (`EPIC-5` — Saved for Later): Conversational Partner Chat & Live AI Coaching
- [ ] **`TKT-501` (Re-enable Partner Chat Overlay & Live Streaming AI)**: Parked until `EPIC-1`..`EPIC-4` are user-accepted.
