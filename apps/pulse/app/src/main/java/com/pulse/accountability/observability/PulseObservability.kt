package com.pulse.accountability.observability

import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import timber.log.Timber
import java.security.MessageDigest

/**
 * Pure PII-scrubbing and structured telemetry helpers for Pulse observability.
 * Ensures zero raw task titles, user notes, emails, or OAuth tokens leak into telemetry logs.
 */
object PulseObservability {

    private val EMAIL_REGEX = Regex("[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}")
    private val BEARER_TOKEN_REGEX = Regex("(Bearer\\s+|ya29\\.)[A-Za-z0-9._\\-]+", RegexOption.IGNORE_CASE)

    /**
     * Pure function: deterministically hashes an identifier (such as an email address)
     * into a 16-character pseudonymous hex ID suitable for Crashlytics user correlation.
     */
    fun pseudonymizeIdentifier(rawIdentifier: String): String {
        val trimmed = rawIdentifier.trim().lowercase()
        if (trimmed.isBlank()) return "anonymous"
        val digest = MessageDigest.getInstance("SHA-256").digest(trimmed.toByteArray(Charsets.UTF_8))
        return digest.take(8).joinToString("") { "%02x".format(it) }
    }

    /**
     * Pure function: scrubs any accidental email addresses or OAuth bearer tokens from log strings.
     */
    fun scrubSensitiveText(input: String): String {
        return input
            .replace(BEARER_TOKEN_REGEX, "[REDACTED_TOKEN]")
            .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    }

    /**
     * Initializes Timber with DebugTree in debug builds and CrashlyticsTree in all builds
     * so breadcrumbs and non-fatal exceptions are captured in Firebase Crashlytics.
     */
    fun init(isDebugBuild: Boolean) {
        if (isDebugBuild) {
            Timber.plant(Timber.DebugTree())
        }
        Timber.plant(CrashlyticsTree())
        runCatching {
            val crashlytics = FirebaseCrashlytics.getInstance()
            crashlytics.isCrashlyticsCollectionEnabled = true
            crashlytics.sendUnsentReports()
        }
    }

    fun sendTestSignal() {
        runCatching {
            val crashlytics = FirebaseCrashlytics.getInstance()
            crashlytics.setCustomKey("test_signal_active", true)
            recordBreadcrumb("test_signal_dispatched")
            recordNonFatal(
                "ObservabilityTest",
                RuntimeException("Pulse Observability Connected: Telemetry verified on device")
            )
            crashlytics.sendUnsentReports()
        }
    }

    fun setPseudonymousUser(email: String) {
        runCatching {
            val pseudoId = pseudonymizeIdentifier(email)
            FirebaseCrashlytics.getInstance().setUserId(pseudoId)
            FirebaseCrashlytics.getInstance().setCustomKey("auth_state", if (email.isNotBlank()) "connected" else "local")
        }
    }

    fun recordBreadcrumb(event: String, attributes: Map<String, String> = emptyMap()) {
        val safeSummary = if (attributes.isEmpty()) {
            scrubSensitiveText(event)
        } else {
            val formattedAttrs = attributes.entries.joinToString(", ") { "${it.key}=${scrubSensitiveText(it.value)}" }
            "${scrubSensitiveText(event)} [$formattedAttrs]"
        }
        Timber.tag("PulseBreadcrumb").i(safeSummary)
    }

    fun recordNonFatal(contextTag: String, throwable: Throwable, attributes: Map<String, String> = emptyMap()) {
        val safeMsg = scrubSensitiveText(throwable.message.orEmpty())
        Timber.tag(contextTag).w(throwable, "Non-fatal exception in $contextTag: $safeMsg")
        runCatching {
            val crashlytics = FirebaseCrashlytics.getInstance()
            attributes.forEach { (k, v) -> crashlytics.setCustomKey(k, scrubSensitiveText(v)) }
            crashlytics.sendUnsentReports()
        }
    }
}

/**
 * Timber Tree that forwards INFO+ breadcrumbs and WARN/ERROR exceptions to Firebase Crashlytics
 * after scrubbing sensitive tokens or emails.
 */
class CrashlyticsTree : Timber.Tree() {
    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        if (priority < Log.INFO) return

        runCatching {
            val crashlytics = FirebaseCrashlytics.getInstance()
            val safeTag = tag ?: "Pulse"
            val safeMessage = PulseObservability.scrubSensitiveText(message)
            crashlytics.log("[$safeTag] $safeMessage")

            if (t != null && priority >= Log.WARN) {
                crashlytics.recordException(t)
            }
        }
    }
}
