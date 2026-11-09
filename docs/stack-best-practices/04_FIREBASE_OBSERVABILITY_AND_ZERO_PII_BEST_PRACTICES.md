# 4. Firebase Crashlytics, Analytics & Zero-PII Observability Best Practices

> **Stack Scope**: Firebase Project `gw-cli-490302`, Firebase Crashlytics (`androidMain`), Firebase Analytics / Web JS SDK (`wasmJsMain` & `web/`), Timber, and Pure Zero-PII Scrubbing (`commonMain`).
> **Real App Reference**: [`PulseObservability.kt`](../../../app/src/main/java/com/pulse/accountability/observability/PulseObservability.kt), [`GoogleAuthDiagnostics.kt`](../../../app/src/main/java/com/pulse/accountability/observability/GoogleAuthDiagnostics.kt)

---

## 1. Core Mandate: A Live, Functional Firebase Dashboard with Zero PII

Observability is not optional and must never be a no-op stub:
1. **Live Firebase Dashboard (`gw-cli-490302`)**: Both Android (`1:57027711654:android:f263696af8fb2c7cdada67`) and Web (`wasmJs`) must actively transmit structured breadcrumbs, user journey events, and non-fatal diagnostics to the Firebase project so the **Firebase Console Dashboard** reflects real-time health.
2. **Strict Zero-PII Gate**: Task titles, task notes, raw email addresses, and OAuth2 bearer tokens (`Bearer ...`, `ya29....`) must **never** leave the device. Every string is scrubbed in pure Kotlin before reaching any Firebase SDK.

---

## 2. Pure Zero-PII Scrubber & Pseudonymizer (`commonMain`)

### Real Example from `Pulse` ([`PulseObservability.kt`](../../../app/src/main/java/com/pulse/accountability/observability/PulseObservability.kt))
```kotlin
object PulseObservability {
    private val EMAIL_REGEX = Regex("[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}")
    private val BEARER_TOKEN_REGEX = Regex("(Bearer\\s+|ya29\\.)[A-Za-z0-9._\\-]+", RegexOption.IGNORE_CASE)

    /**
     * Pure function: scrubs any accidental email addresses or OAuth bearer tokens from log strings.
     */
    fun scrubSensitiveText(input: String): String {
        return input
            .replace(BEARER_TOKEN_REGEX, "[REDACTED_TOKEN]")
            .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    }
}
```
- **Unit Test Gate**: [`PulseObservabilityTest.kt`](../../../app/src/test/java/com/pulse/accountability/observability/PulseObservabilityTest.kt) verifies that strings like `"Sync failed for stefan@gmail.com with token Bearer ya29.A0ARrdaM_secret123"` are deterministically transformed into `"Sync failed for [REDACTED_EMAIL] with token [REDACTED_TOKEN]"`.

---

## 3. Multiplatform Firebase Dispatch (`androidMain` + `wasmJsMain`)

### 3.1 Android Native Sink (`androidMain`)
- Plant `CrashlyticsTree` into `Timber` at application startup (`PulseApplication.onCreate()`).
- Explicitly enable collection (`crashlytics.isCrashlyticsCollectionEnabled = true`) and call `crashlytics.sendUnsentReports()` on startup and whenever a non-fatal exception or diagnostic test signal is recorded so reports appear immediately in the Firebase Console without waiting for the next app cold start.

### 3.2 Web / KMP `wasmJs` Sink (`wasmJsMain`)
- Load the Firebase Web SDK (`firebase-app`, `firebase-analytics`) initialized with project `gw-cli-490302` in `index.html` and expose a clean JS interop bridge (`window.pulseFirebaseTelemetry.recordEvent(name, paramsJson)`).
- Mirror every scrubbed breadcrumb into an in-memory observable ring buffer (`recentBreadcrumbs: StateFlow<List<String>>`) surfaced inside **`Settings -> Privacy & Diagnostics`** so developers and users can inspect the exact zero-PII events sent to Firebase in real time.

---

## 4. In-App `"Send Test Telemetry to Firebase"` Verification Button

Every app surface (`Android` and `Web`) includes a 1-tap **"Send Test Telemetry to Firebase"** button inside [`PartnerSettingsNavigator.kt`](../../../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) (`SettingsSubPage.DIAGNOSTICS`) that calls `PulseObservability.sendTestSignal()`:
1. Sets custom key `test_signal_active = true`.
2. Records breadcrumb `test_signal_dispatched`.
3. Dispatches a non-fatal `ObservabilityTest` diagnostic event and flushes `sendUnsentReports()`.
4. Confirms delivery in the UI snackbar and live breadcrumb log.
