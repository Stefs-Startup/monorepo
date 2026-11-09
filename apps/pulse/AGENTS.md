# Pulse Engineering & Collaboration Constitution

## 1. Incremental Pairing, Epic-Stream Planning & User Acceptance Gate
- **User-Facing Epic Streams vs. Agent-Internal Technical Ticketing**:
  - **Present Epic Streams Only to the User**: When discussing roadmap planning, sprint priorities, or progress with the user, present high-level **Epic Streams** (`EPIC-1`..`EPIC-N`) framed around user value and User Acceptance Testing (UAT) checkpoints.
  - **Self-Managed Compartmentalized Technical Tickets (`TKT-xxx`)**: The agent is responsible for decomposing each Epic Stream into small, compartmentalized technical tickets (`TKT-xxx`) internally, executing the engineering and verification work, and presenting self-contained slices for user review and acceptance.
- **No Unreviewed Multi-Feature Jumps**: Never bundle multiple unrequested features or architectural layers in a single turn.
- **Explicit Acceptance Criteria (AC)**: Every technical change must define clear, deterministic Acceptance Criteria before implementation and pause for explicit user acceptance after verification.
- **Mandatory Docs-as-Code Release Gate**: No version or increment is considered **Done** until its corresponding in-repository documentation (`README.md`, `docs/UX_FLOW_AND_DESIGN_SYSTEM.md`, `docs/SPRINT_ROADMAP_AND_USE_CASES.md`, `docs/CHANGELOG.md`, and `docs/tech-docs/STACK_BEST_PRACTICES.md`) is updated in the same Git commit/version, mapping the change to Prime Use Cases and recording the exact version/commit state.
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

## 4. Modern Web & Desktop Principles, Adaptive Compose Taste & WCAG 2.2 AA Accessibility Standards
- **Modern Desktop Web Principles Over Rigid Mobile Material Boilerplate (`ADR-009`)**:
  - On Desktop & Web viewports (`>= 840.dp`), prioritize **modern web design principles** (multi-pane split workspaces with persistent right-hand Task Inspector, crisp `1.dp` hairline borders, subtle surface contrast, `10.dp–14.dp` desktop corner radii, tabular numerals, hover highlights, pointer cursors, and keyboard shortcuts `1`/`2`/`3`, `↑`/`↓`, `P`, `S`, `D`) rather than stretching mobile Material 3 chrome across a wide monitor.
  - On Mobile viewports (`< 600.dp`), use standard Material 3 bottom `NavigationBar` (`Horizon`, `Undone Log`, `Settings`) and expressive touch cards.
- **No App-Name Vanity Branding in Headers**: Never advertise the app name (`"Pulse • ..."`) in primary screen headers. Use concise, contextual titles (`"Horizon"`, `"Undone Log"`, `"Settings"`) inside a compact header.
- **No Redundant Task Creation Chrome**: Pulse is an accountability partner for Google Tasks, not a duplicate task manager. Do not clutter the screen with a `"Commit Task"` FAB.
- **Visual Focus Dashboard First vs. Structured Log**:
  - The primary home destination (`Horizon`) is a calm **Visual Focus Dashboard** with the Top-3 Scarcity Strip, 3 descending analytical windows, and Selected Task Inspector (saving Partner Chat for `EPIC-5`).
  - Individual task cards with metadata badges belong in the secondary `Undone Log` view as an honest audit trail.
- **Automated WCAG 2.2 AA Accessibility Gate (`ColorContrastAudit`)**:
  - Every foreground/background token pair in `PulseExpressiveTheme` (both Light and Dark schemes) must pass deterministic JUnit contrast ratio tests (`>= 4.5:1` for normal text, `>= 3.0:1` for large text/UI components per WCAG 2.2 SC 1.4.3) before any UI build is installed.
  - All interactive controls must expose explicit semantic `contentDescription` and respect `48.dp` minimum touch targets on mobile and clear hover/focus states on desktop web.
  - Persistent living UX and stack best-practice documentation must be maintained in `docs/UX_FLOW_AND_DESIGN_SYSTEM.md` and `docs/tech-docs/STACK_BEST_PRACTICES.md`.

## 5. Version Control, Docs-as-Code & CI/CD Governance (`Stef-Startup`)
- **Atomic Code + Docs Commits**: Every verified increment must update the relevant Markdown docs under `docs/` and `README.md`, log the version entry in `docs/CHANGELOG.md`, and be committed to local `git` immediately so the working tree remains clean, versioned, and auditable.
- **Remote Repository Confirmation Gate**: When remote repositories or ephemeral GitHub Actions CI pipelines are needed under the **`Stef-Startup`** GitHub organization, **always ask the user for confirmation before creating remote repositories or pushing branches**.
