# `apps/pulse/google-auth` — Reusable Kotlin Google OAuth & Tasks Module

Shared Kotlin Multiplatform library (`com.stefs.googleauth`) built with `id("stefs.kotlin-lib")` providing Google OAuth contracts, Zero-PII sign-in diagnostics (`GoogleAuthDiagnosticsEngine`), `GoogleTasksProvider` / `OkHttpGoogleTasksClient`, and deterministic fake providers (`FakeGoogleOAuthProvider`, `FakeGoogleTasksProvider`) for credential-free local and CI testing.

*(TypeScript counterpart for web/Node apps: [`packages/google-auth`](../../../packages/google-auth/README.md).)*

## Verification

```bash
cd apps/pulse
./gradlew :google-auth:jvmTest
```
