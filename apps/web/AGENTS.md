# `@cmp/web` Engineering Constitution

## 1. Pure Functional Core (`ADR-007`)
- All domain logic, state evaluation, theme audits, and diagnostic formatters in `apps/web/src/` must be implemented as **pure, stateless functions** with zero DOM, browser storage, or network side effects in domain modules.
- Compose shared factory primitives from `@cmp/utils` rather than duplicating contrast math, PII redaction, or scarcity logic.

## 2. Automated WCAG 2.2 Level AA Accessibility Gate
- Every foreground/background surface and text color pair (across both light and dark themes) must be verified via `auditThemePalette()` from `@cmp/utils`.
- Normal text pairs must maintain a minimum contrast ratio of **`>= 4.5:1`** (and `>= 3.0:1` for large text / UI components per WCAG 2.2 SC 1.4.3).
- Any failing contrast pair must fail `pnpm --filter @cmp/web test`.

## 3. Zero-PII Telemetry & Pseudonymization
- Raw email addresses, OAuth bearer tokens (`Bearer <token>`), and Google OAuth tokens (`ya29.<token>`) must **never** be logged or emitted in telemetry.
- All diagnostic messages and structured breadcrumbs must pass through `scrubSensitiveText()`, `pseudonymizeIdentifier()`, and `createZeroPiiBreadcrumb()` from `@cmp/utils`.

## 4. Modern Desktop Web UX & Scarcity Discipline (`ADR-009`)
- Prioritize modern desktop web ergonomics (crisp `1px` hairline borders, multi-pane split layouts on wide viewports `>= 840px`, keyboard shortcuts, and hover states) aligned with `docs/stack-best-practices/`.
- Enforce Top-3 focus scarcity with `evaluateScarcityGate()` and strict descending analytical ordering with `isStrictlyDescendingByScore()`.

## 5. Verification Gate
Before any slice is considered complete, all of the following must pass with zero errors:
- `pnpm --filter @cmp/web typecheck`
- `pnpm --filter @cmp/web lint`
- `pnpm --filter @cmp/web test`
- `pnpm --filter @cmp/web build`
