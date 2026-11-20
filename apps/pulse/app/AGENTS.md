# Agent Guidelines (`apps/pulse/app`)

Android UI module for Pulse (Kotlin + Jetpack Compose). Keep changes aligned with [../AGENTS.md](../AGENTS.md) and root `AGENTS.md`.

## Build & Test

Run commands from the parent `apps/pulse` Gradle root (or via repo root `scripts/check.sh`):

```bash
scripts/check.sh --stack android

# Or run directly inside apps/pulse:
./gradlew :app:lintDebug --stacktrace
./gradlew :app:assembleDebug --stacktrace
./gradlew :app:testDebugUnitTest --stacktrace
```

## Conventions

- **Pinned Versions**: AGP `8.7.3`, Kotlin `2.1.0`, `compileSdk`/`targetSdk = 35`, `minSdk = 28`, Java/Kotlin JVM target `17` (CI runs JDK 21).
- **Pure Functional Core (`ADR-007`)**: Keep domain logic, scarcity gates, and Zero-PII scrubbers stateless with zero Android `Context` dependencies.
- **UI & Accessibility**: Use Material 3 adaptive layouts and maintain WCAG 2.2 AA contrast (`>= 4.5:1` normal text, `>= 3.0:1` large text) covered by unit tests.
- **Observability**: Never log raw emails, task titles, or OAuth tokens (`ya29.` / `Bearer`); route breadcrumbs through `PulseObservability`.

## Do Not Touch

- **Do NOT add `apps/pulse` or `apps/pulse/app` to root `pnpm-workspace.yaml`** — Gradle isolation is intentional.
- **Do NOT bump AGP or Gradle wrapper major versions** without SDK 35 CI verification (see `.github/dependabot.yml` ignore rules).
- Never commit `local.properties`, `.keystore` files, or API credentials.

## Common Pitfalls

- Running `./gradlew` inside `apps/pulse/app` fails because the Android Gradle wrapper lives one level up in `apps/pulse/gradlew`.
- Running `:app:lintDebug` or `:app:testDebugUnitTest` without `ANDROID_HOME` / `ANDROID_SDK_ROOT` fails locally unless `apps/pulse/local.properties` points to the Android SDK.
- Wireless ADB debugging fails if an on-device VPN is active; disable the VPN and re-toggle Wireless Debugging.
