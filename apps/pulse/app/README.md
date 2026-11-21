# `apps/pulse/app` — Android Kotlin / Jetpack Compose Client

Native Android Compose application for Pulse, built with `id("stefs.android-app")` from [`build-logic/`](../../../build-logic/README.md), consuming `:google-auth` ([`../google-auth/README.md`](../google-auth/README.md)) and root [`gradle/libs.versions.toml`](../../../gradle/libs.versions.toml).

## Prerequisites

- JDK `21` (`temurin-21`)
- Android SDK (`ANDROID_HOME` set, compileSdk `35`)

## Local Build & Verification

```bash
cd apps/pulse
./gradlew :app:lintDebug
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest   # Includes PulseCriticalJourneysUiTest
```

From the repo root: `ANDROID_HOME=~/Library/Android/sdk ./scripts/check.sh --stack android`.

## UI Flows & Distribution

- **Maestro Critical Journeys:** `maestro/` (`onboarding-flow.yaml`, `top3-scarcity-flow.yaml`, `rescue-triage-flow.yaml`), validated in CI by `.github/workflows/android-ui-tests.yml`.
- **Distribution:** `.github/workflows/deploy-pulse-android.yml` routes `main` Android changes to Firebase App Distribution and `pulse-android-v*` tags to Google Play Internal via `.github/workflows/reusable-android-deploy.yml`.
