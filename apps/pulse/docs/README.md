# Pulse Docs

Pulse is a calm accountability partner for Google Tasks. The full product overview lives in
[`apps/pulse/README.md`](../README.md).

## Stacks

| Component | Path | Toolchain | CI commands |
| :--- | :--- | :--- | :--- |
| `pulse-android` | `apps/pulse` (`:app`) | Gradle wrapper, JDK 17, Android SDK 35 | `./gradlew lintDebug assembleDebug testDebugUnitTest` |
| `pulse-backend` | `apps/pulse/backend` | Standalone Gradle build, Java 21 toolchain | `./gradlew classes testClasses test` |
| `pulse-web` | `apps/pulse/web` | npm (`package-lock.json`), Angular 21, Vitest | `npm ci && npx tsc --noEmit && npm run build && npm test` |

All three are built and tested by `.github/workflows/ci.yml` and kept current by `.github/dependabot.yml`
(see [ADR-0003](../../../docs/adr/0003-monorepo-ci-cd-and-dependabot.md)).

## Contents

- [Changelog](CHANGELOG.md)
- [Sprint Roadmap & Use Cases](SPRINT_ROADMAP_AND_USE_CASES.md)
- [UX Flow & Design System](UX_FLOW_AND_DESIGN_SYSTEM.md)
- Tech docs
  - [Stack Best Practices](tech-docs/STACK_BEST_PRACTICES.md)
  - [Stickiness & Ritual Architecture](tech-docs/STICKINESS_AND_HABITUAL_RITUAL_ARCHITECTURE.md)
  - [Tech Stack Runbook & Knowledge Sources](tech-docs/TECH_STACK_RUNBOOK_AND_KNOWLEDGE_SOURCES.md)
  - [Full-State Debrief & Verification Report](tech-docs/FULL_STATE_DEBRIEF_AND_VERIFICATION_REPORT.md)
  - [Best Practices library](tech-docs/best-practices/README.md)
