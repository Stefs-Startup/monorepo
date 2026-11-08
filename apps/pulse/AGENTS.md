# Pulse Engineering & Collaboration Constitution

## 1. Incremental Pairing, Docs-as-Code & User Acceptance Gate
- **No Unreviewed Multi-Feature Jumps**: Never bundle multiple unrequested features or architectural layers in a single turn.
- **Explicit Acceptance Criteria (AC)**: Every technical change must define clear, deterministic Acceptance Criteria before implementation and pause for explicit user acceptance after verification.
- **Mandatory Docs-as-Code Release Gate**: No version or increment is considered **Done** until its corresponding in-repository documentation (`README.md`, `docs/UX_FLOW_AND_DESIGN_SYSTEM.md`, `docs/SPRINT_ROADMAP_AND_USE_CASES.md`, and `docs/CHANGELOG.md`) is updated in the same Git commit/version, mapping the change to Prime Use Cases and recording the exact version/commit state.
- **Continuous Feedback Loop Integration**: Every version must preserve and evaluate the closed-loop feedback cycle (in-app partner reflection signals + zero-PII diagnostic breadcrumbs + device verification findings) so user friction directly informs the next sprint's acceptance criteria.
- **Human-Handoff Transparency**: Immediately flag external cloud console steps (e.g., OAuth 2.0 Client ID creation or Consent Screen publishing) as explicit human handoffs rather than masking failures.

## 2. Pure Functional Core & Test Pyramid
- **Pure Functions First (`ADR-007`)**: All domain rules, classification engines (`UndoneAccountabilityEngine`), scarcity gates (`ScarcityEngine`), PII scrubbers (`PulseObservability`), and error diagnostics (`GoogleAuthDiagnostics`) must be pure, stateless functions with zero Android `Context` dependencies.
- **Test Pyramid**:
  1. **Unit Tests (`src/test`)**: Fast, deterministic JUnit4 tests covering 100% of pure functions and edge cases.
  2. **Integration & Contract Tests (`src/test`)**: Ephemeral server/container contract tests (`MockWebServer` / Testcontainers where applicable) verifying HTTP status codes (`200`, `401`, `403`), JSON serialization, and OAuth token headers.
  3. **End-to-End (E2E) Device Verification**: Automated UI verification on the local `Resizable_Experimental` emulator (`emulator-5554`) and connected physical hardware (`Pixel 8 Pro`) with logcat and visual proof.

## 3. Full-Path Observability & Zero-PII Telemetry
- Every user action and failure path (Onboarding, Google OAuth, Tasks Sync, Conversational Reflection, Top-3 Pin/Swap, Triage) must emit structured breadcrumbs via `PulseObservability.recordBreadcrumb()`.
- Every caught exception must be classified through pure diagnostic utilities, surfaced clearly in the UI, and reported via `PulseObservability.recordNonFatal()` with immediate `sendUnsentReports()` flush.
- Zero PII (no task titles, notes, raw emails, or OAuth tokens) may ever leave the device; all logs pass through `PulseObservability.scrubSensitiveText()`.

## 4. Material 3 Design Taste & WCAG 2.2 AA Accessibility Standards
- **No App-Name Vanity Branding in Headers**: Never advertise the app name (`"Pulse • ..."`) in primary screen headers. Use concise, contextual titles (`"Reflect"`, `"Undone Log"`, `"Settings"`) inside a standard, compact `TopAppBar` (never an oversized `LargeTopAppBar` with nested columns that overflows or wastes vertical space).
- **Proper Material 3 Navigation (`NavigationBar`)**: Always use standard Material 3 bottom `NavigationBar` with clear icons and labels (`Reflect`, `Undone Log`, `Settings`) instead of ad-hoc icon buttons stuffed into top app bar actions.
- **No Redundant Task Creation Chrome**: Pulse is an accountability partner for Google Tasks, not a duplicate task manager. Do not clutter the screen with a `"Commit Task"` FAB.
- **Warm Conversational Main Surface vs. Structured Log**:
  - The primary home destination (`Reflect`) must be an alive, warm conversational stream where the partner talks through habitually undone/long-standing tasks directly inline.
  - Individual task cards with metadata badges belong in the secondary `Undone Log` view as an honest audit trail.
- **Automated WCAG 2.2 AA Accessibility Gate (`ColorContrastAudit`)**:
  - Every foreground/background token pair in `PulseExpressiveTheme` (both Light and Dark schemes) must pass deterministic JUnit contrast ratio tests (`>= 4.5:1` for normal text, `>= 3.0:1` for large text/UI components per WCAG 2.2 SC 1.4.3) before any UI build is installed.
  - All interactive controls must expose explicit semantic `contentDescription` and respect `48.dp` minimum touch targets.
  - Persistent living UX documentation must be maintained in `docs/UX_FLOW_AND_DESIGN_SYSTEM.md`.

## 5. Version Control, Docs-as-Code & CI/CD Governance (`Stef-Startup`)
- **Atomic Code + Docs Commits**: Every verified increment must update the relevant Markdown docs under `docs/` and `README.md`, log the version entry in `docs/CHANGELOG.md`, and be committed to local `git` immediately so the working tree remains clean, versioned, and auditable.
- **Remote Repository Confirmation Gate**: When remote repositories or ephemeral GitHub Actions CI pipelines are needed under the **`Stef-Startup`** GitHub organization, **always ask the user for confirmation before creating remote repositories or pushing branches**.
