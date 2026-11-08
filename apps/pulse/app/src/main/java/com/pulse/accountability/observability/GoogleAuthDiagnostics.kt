package com.pulse.accountability.observability

import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes

data class AuthDiagnosticResult(
    val statusCode: Int?,
    val statusName: String,
    val userFacingTitle: String,
    val userFacingExplanation: String,
    val remediationStep: String,
    val telemetryAttributes: Map<String, String>
)

/**
 * Pure functional diagnostics classifier for Google OAuth and Tasks Sync failures.
 * Zero Android Context or UI dependencies — 100% deterministic for unit testing.
 */
object GoogleAuthDiagnostics {

    fun classifySignInFailure(throwable: Throwable): AuthDiagnosticResult {
        val apiEx = throwable as? ApiException
        val code = apiEx?.statusCode ?: extractStatusCodeFromMessage(throwable.message)

        return when (code) {
            10 -> AuthDiagnosticResult(
                statusCode = 10,
                statusName = "DEVELOPER_ERROR",
                userFacingTitle = "OAuth Client Configuration Mismatch (Code 10)",
                userFacingExplanation = "Google Play Services rejected the sign-in request because the Android OAuth 2.0 Client ID (package com.pulse.accountability + SHA-1) or OAuth Consent Screen is not yet registered in Google Cloud Console.",
                remediationStep = "Register an Android OAuth 2.0 Client ID in Google Cloud Console (APIs & Services > Credentials) for com.pulse.accountability with debug SHA-1 B5:C2:92:ED:7B:F6:BC:30:C1:0F:F3:69:28:75:96:3B:17:B0:BF:E9.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to "10",
                    "auth_error_name" to "DEVELOPER_ERROR",
                    "exception_type" to throwable.javaClass.simpleName
                )
            )

            12500 -> AuthDiagnosticResult(
                statusCode = 12500,
                statusName = "SIGN_IN_FAILED",
                userFacingTitle = "OAuth Consent Screen Incomplete (Code 12500)",
                userFacingExplanation = "Google Play Services could not complete the sign-in handshake because the OAuth Consent Screen in Google Cloud Console is missing a support email, test user, or the Tasks scope.",
                remediationStep = "In Google Cloud Console > OAuth consent screen, add your Google account as a Test User and ensure https://www.googleapis.com/auth/tasks is listed.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to "12500",
                    "auth_error_name" to "SIGN_IN_FAILED",
                    "exception_type" to throwable.javaClass.simpleName
                )
            )

            12501, CommonStatusCodes.CANCELED -> AuthDiagnosticResult(
                statusCode = code,
                statusName = "SIGN_IN_CANCELED",
                userFacingTitle = "Sign-In Sheet Closed (Code $code)",
                userFacingExplanation = "The Google account picker was dismissed or canceled before completing sign-in (or Play Services aborted due to missing OAuth client registration).",
                remediationStep = "Tap 'Sign In with Google' again, or verify that the Android OAuth Client ID is active in Google Cloud Console.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to code.toString(),
                    "auth_error_name" to "SIGN_IN_CANCELED",
                    "exception_type" to throwable.javaClass.simpleName
                )
            )

            CommonStatusCodes.NETWORK_ERROR -> AuthDiagnosticResult(
                statusCode = CommonStatusCodes.NETWORK_ERROR,
                statusName = "NETWORK_ERROR",
                userFacingTitle = "Network Connection Error (Code 7)",
                userFacingExplanation = "Google Play Services could not reach Google's authentication servers.",
                remediationStep = "Check Wi-Fi or cellular connectivity and retry.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to "7",
                    "auth_error_name" to "NETWORK_ERROR",
                    "exception_type" to throwable.javaClass.simpleName
                )
            )

            else -> {
                val safeMsg = PulseObservability.scrubSensitiveText(throwable.localizedMessage ?: "Unknown error")
                AuthDiagnosticResult(
                    statusCode = code,
                    statusName = "UNCLASSIFIED_AUTH_ERROR",
                    userFacingTitle = "Google Sign-In Error${if (code != null) " (Code $code)" else ""}",
                    userFacingExplanation = "Sign-in did not complete: $safeMsg",
                    remediationStep = "Verify OAuth Client ID and Tasks API scope in Google Cloud Console.",
                    telemetryAttributes = mapOf(
                        "auth_error_code" to (code?.toString() ?: "none"),
                        "auth_error_name" to "UNCLASSIFIED_AUTH_ERROR",
                        "exception_type" to throwable.javaClass.simpleName
                    )
                )
            }
        }
    }

    internal fun extractStatusCodeFromMessage(message: String?): Int? {
        if (message.isNullOrBlank()) return null
        val match = Regex("^(\\d+):").find(message.trim()) ?: Regex("\\b(10|12500|12501|16|7)\\b").find(message)
        return match?.groupValues?.getOrNull(1)?.toIntOrNull()
    }
}
