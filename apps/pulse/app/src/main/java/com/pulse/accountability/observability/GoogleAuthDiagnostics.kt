package com.pulse.accountability.observability

import com.google.android.gms.common.api.ApiException
import com.stefs.googleauth.GoogleAuthDiagnosticsEngine

data class AuthDiagnosticResult(
    val statusCode: Int?,
    val statusName: String,
    val userFacingTitle: String,
    val userFacingExplanation: String,
    val remediationStep: String,
    val telemetryAttributes: Map<String, String>
)

/**
 * Pure functional diagnostics classifier for Google OAuth and Tasks Sync failures,
 * backed by the reusable `:google-auth` (`com.stefs.googleauth`) module.
 */
object GoogleAuthDiagnostics {

    fun classifySignInFailure(throwable: Throwable): AuthDiagnosticResult {
        val apiEx = throwable as? ApiException
        val diagnostic = GoogleAuthDiagnosticsEngine.classifySignInFailure(
            explicitStatusCode = apiEx?.statusCode,
            rawMessage = throwable.localizedMessage ?: throwable.message,
            exceptionType = throwable.javaClass.simpleName,
            appPackageName = "com.pulse.accountability",
            scrubber = PulseObservability::scrubSensitiveText
        )
        return AuthDiagnosticResult(
            statusCode = diagnostic.statusCode,
            statusName = diagnostic.statusName,
            userFacingTitle = diagnostic.userFacingTitle,
            userFacingExplanation = diagnostic.userFacingExplanation,
            remediationStep = diagnostic.remediationStep,
            telemetryAttributes = diagnostic.telemetryAttributes
        )
    }

    internal fun extractStatusCodeFromMessage(message: String?): Int? =
        GoogleAuthDiagnosticsEngine.extractStatusCodeFromMessage(message)
}
