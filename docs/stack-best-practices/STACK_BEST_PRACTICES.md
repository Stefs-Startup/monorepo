# Pulse — Engineering & Design Best Practices Guide (All Stacks)

> **Living Human-Readable Reference (`Docs-as-Code`)**: Maintained alongside every release so any engineer, designer, or reviewer can quickly understand how we build, style, test, and observe across all stacks in this repository.

---

## 1. Modern Desktop Web & Adaptive Multiplatform UX Principles (`ADR-009`)

While Android mobile (`< 600.dp`) uses Material 3 touch patterns, **Web & Desktop (`>= 840.dp`) must feel like a first-class modern web application** (inspired by Linear, Raycast, and modern SaaS workspaces)—not a stretched phone screen or rigid Material 3 boilerplate.

| Principle | Mobile (`< 600.dp` Touch) | Modern Desktop & Web (`>= 840.dp` Pointer + Keyboard) |
| :--- | :--- | :--- |
| **Navigation Chrome** | Bottom 3-tab `NavigationBar` (`Horizon`, `Undone Log`, `Settings`) within thumb reach. | Compact left sidebar / workspace rail (`220.dp` max) or slim top command header—**never** a full-width bottom navigation bar on desktop. |
| **Viewport & Spatial Density** | Single-column vertical stack with `48.dp` touch targets and generous vertical padding. | **Multi-Pane Split Workspace (`max-width: 1440.dp`)**: Left/Center pane displays the **Top-3 Scarcity Strip** + **3-Window Descending Horizon**; Right pane (`380.dp–440.dp`) docks the **Persistent Task Inspector** so selecting a bar never causes vertical page jumping. |
| **Surface & Border Aesthetics** | Material 3 tonal elevation (`surfaceContainerLow`..`High`) with `28.dp` rounded corners. | **Crisp 1px Hairline Borders & Subtle Glass/Surface Contrast**: Tighter corner radii (`10.dp–14.dp`), `1.dp` hairline borders (`outlineVariant` at `35%` alpha), tabular numerals (`font-variant-numeric: tabular-nums`), and balanced information density. |
| **Pointer & Hover Affordances** | Tap and horizontal swipe gestures (`HorizontalPager`). | **First-Class Hover, Pointer & Focus States**: Instant row highlight on mouse hover, pointer cursor feedback, segmented window tabs clickable without dragging, and visible `:focus-visible` rings. |
| **Keyboard-First Shortcuts** | System back gesture (`BackHandler`). | Single-key and chord shortcuts: `1` / `2` / `3` to switch Horizon windows, `↑` / `↓` (`J` / `K`) to step through descending rank bars (`#1..#N`), `P` to Pin/Unpin Top 3, `S` to Shrink to 5m, `D` to mark Done, and `Esc` to dismiss modals. |

---

## 2. Stack-by-Stack Engineering Best Practices

### 2.1 Kotlin Multiplatform (`KMP`) & Compose Multiplatform (`commonMain`, `androidMain`, `wasmJsMain`)
- **Single Source of Truth (`commonMain`)**:
  - Put **100% of domain rules** ([`UndoneAccountabilityEngine.kt`](../../app/src/main/java/com/pulse/accountability/domain/UndoneAccountabilityEngine.kt), [`TaskVisualAnalyticsEngine.kt`](../../app/src/main/java/com/pulse/accountability/domain/TaskVisualAnalyticsEngine.kt), [`ScarcityEngine.kt`](../../app/src/main/java/com/pulse/accountability/domain/ScarcityEngine.kt), [`TriageRules.kt`](../../app/src/main/java/com/pulse/accountability/domain/TriageRules.kt), [`RitualGateRules.kt`](../../app/src/main/java/com/pulse/accountability/domain/RitualGateRules.kt), [`WcagContrastEngine.kt`](../../app/src/main/java/com/pulse/accountability/ui/theme/WcagContrastEngine.kt)) and **shared responsive Compose components** ([`AccountabilityHorizonCanvas.kt`](../../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt), [`StalledTaskLogCard.kt`](../../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt), [`PartnerSettingsNavigator.kt`](../../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt), [`PulseExpressiveTheme.kt`](../../app/src/main/java/com/pulse/accountability/ui/theme/PulseExpressiveTheme.kt)) in `commonMain`.
  - Never import `java.time.*`, `java.util.UUID`, or `android.content.Context` in `commonMain`; use `kotlinx-datetime` (`Instant`, `LocalDate`, `TimeZone`) and `kotlin.uuid.Uuid`.
- **Adaptive Component Signatures**:
  - Every shared screen or card composable must accept `modifier: Modifier = Modifier` and adapt to viewport width (`BoxWithConstraints` / `WindowWidthSizeClass`) so the exact same composable renders a stacked mobile view (`< 600.dp`) and a multi-pane desktop workspace (`>= 840.dp`).
- **State Hoisting & Unidirectional Data Flow (UDF)**:
  - Pass immutable UI state (`PulseUiState`) down and lambda callbacks (`onSelectTaskById`, `onTriageAction`) up. Keep composables stateless and side-effect-free for fast previewing and deterministic testing.

### 2.2 Native Android (`app/` & `androidMain`)
- **Offline-First Persistence (`Room` + `DataStore`)**:
  - Persist tasks in SQLite via AndroidX Room ([`PulseDatabase.kt`](../../app/src/main/java/com/pulse/accountability/data/local/PulseDatabase.kt)) and user settings in Preferences DataStore ([`UserPreferencesRepository.kt`](../../app/src/main/java/com/pulse/accountability/data/local/UserPreferencesRepository.kt)), exposing cold `Flow<T>` streams converted to hot `StateFlow<T>` via `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initialValue)`.
- **Lifecycle-Safe Collection & Navigation**:
  - Always collect flows in Compose using `collectAsStateWithLifecycle()`.
  - Handle system back navigation explicitly via `BackHandler` on sub-pages and modal overlays.
- **Google OAuth & Sync Resilience**:
  - Classify every Play Services `ApiException` (`statusCode == 10` `DEVELOPER_ERROR`, `401`, `403`, network timeouts) through pure [`GoogleAuthDiagnostics.kt`](../../app/src/main/java/com/pulse/accountability/observability/GoogleAuthDiagnostics.kt) so the user always sees actionable remediation instead of silent failures.

### 2.3 Multiplatform Observability & Live Firebase Dashboard (`gw-cli-490302`)
- **Zero-PII Gate (`PulseObservability`)**:
  - Every breadcrumb and exception message **must** pass through [`PulseObservability.scrubSensitiveText()`](../../app/src/main/java/com/pulse/accountability/observability/PulseObservability.kt) (`[REDACTED_EMAIL]`, `[REDACTED_TOKEN]`) and [`PulseObservability.pseudonymizeIdentifier()`](../../app/src/main/java/com/pulse/accountability/observability/PulseObservability.kt) before leaving `commonMain`. Raw task titles or notes are never transmitted to telemetry.
- **Dual-Platform Live Firebase Sinks (`gw-cli-490302`)**:
  - **Android (`androidMain`)**: Plant `CrashlyticsTree` in Timber, enable `FirebaseCrashlytics` + `FirebaseAnalytics`, and call `sendUnsentReports()` immediately on non-fatals and diagnostic test signals.
  - **Web (`wasmJsMain` / Browser)**: Initialize the Firebase Web JS SDK (`firebase/app`, `firebase/analytics`) against project `gw-cli-490302` so web breadcrumbs, triage metrics, and diagnostic test signals flow into the live Firebase Console alongside a local inspectable ring buffer in `Settings -> Diagnostics`.

### 2.4 Angular 21 (`web/`) & Spring Boot 4 / Java 21 (`backend/`) — *Experimental Reference Stack*
- **Angular 21 Standalone Signals (`web/`)**:
  - Use standalone components (`standalone: true`), fine-grained Signals (`signal()`, `computed()`), modern template control flow (`@if`, `@for`, `@switch`), and CSS custom properties verified by `WcagContrastEngine`.
- **Spring Boot 4 + Java 21 (`backend/`)**:
  - Model domain payloads with immutable Java 21 `record` types, `sealed interface` hierarchies (`PinDecision`, `TriageAction`), and exhaustive pattern-matching `switch` expressions. Verify REST controllers with `MockMvc` contract tests (`PulseControllerContractTest`).

---

## 3. Universal Quality Gates (Applies to Every Stack & Commit)

1. **3-Tier Test Pyramid**:
   - **Tier 1 — Pure Unit Tests**: 100% coverage of domain classification, descending Horizon sorting, Top-3 scarcity swaps, WCAG contrast math, and PII scrubbing.
   - **Tier 2 — Component & Contract Tests**: Verify UI state transitions, responsive layout branches (`Compact` vs. `Expanded`), and HTTP status codes (`200`, `400`, `401`, `403`, `404`).
   - **Tier 3 — Live E2E Verification**: Run and visually verify in the live browser (`wasmJs` / Web) and on Android hardware/emulator (`emulator-5554` / `Pixel 8 Pro`).
2. **WCAG 2.2 Level AA Contrast & Keyboard/Screen-Reader Accessibility**:
   - All foreground/background pairs must maintain `>= 4.5:1` contrast for normal text (`>= 3.0:1` for large text/UI components) across Light and Dark themes.
3. **Epic-Stream Planning & Docs-as-Code Lockstep**:
   - Present product progress via **Epic Streams (`EPIC-1`..`EPIC-5`)**, manage `TKT-xxx` tickets internally, and update `README.md`, `docs/UX_FLOW_AND_DESIGN_SYSTEM.md`, `docs/SPRINT_ROADMAP_AND_USE_CASES.md`, `docs/CHANGELOG.md`, and this best-practices guide in the same commit.
