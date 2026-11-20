package com.stefs.googleauth

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
data class GoogleTaskListsResponse(
    val items: List<GoogleTaskListDto> = emptyList()
)

@Serializable
data class GoogleTaskListDto(
    val id: String,
    val title: String
)

@Serializable
data class GoogleTasksResponse(
    val items: List<GoogleTaskDto> = emptyList()
)

@Serializable
data class GoogleTaskDto(
    val id: String? = null,
    val title: String = "",
    val notes: String? = null,
    val status: String = "needsAction",
    val due: String? = null,
    val completed: String? = null,
    val updated: String? = null
)

@Serializable
data class GoogleTaskCreatePayload(
    val title: String,
    val notes: String? = null,
    val status: String = "needsAction",
    val due: String? = null
)

@Serializable
data class GoogleAuthSession(
    val email: String,
    val accessToken: String,
    val expiresAtEpochMillis: Long? = null,
    val scopes: List<String> = listOf(GoogleAuthContract.TASKS_SCOPE)
)

data class GoogleAuthDiagnostic(
    val statusCode: Int?,
    val statusName: String,
    val userFacingTitle: String,
    val userFacingExplanation: String,
    val remediationStep: String,
    val telemetryAttributes: Map<String, String>
)

/**
 * Pure multiplatform Google OAuth + Tasks contract (zero Android or java.time dependencies).
 */
object GoogleAuthContract {
    const val TASKS_SCOPE = "https://www.googleapis.com/auth/tasks"
    const val DEFAULT_BASE_URL = "https://tasks.googleapis.com"

    private val EMAIL_REGEX = Regex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")
    private val GOOGLE_TOKEN_REGEX = Regex("ya29\\.[A-Za-z0-9_-]+")
    private val BEARER_TOKEN_REGEX = Regex("(?i)Bearer\\s+[A-Za-z0-9._-]+")

    fun formatTasksScope(): String = "oauth2:$TASKS_SCOPE"

    fun validateGoogleEmail(email: String): Boolean {
        val trimmed = email.trim()
        if (trimmed.isEmpty() || !trimmed.contains("@") || !trimmed.contains(".")) return false
        val parts = trimmed.split("@")
        return parts.size == 2 && parts[0].isNotEmpty() && parts[1].length >= 3
    }

    fun isAuthorizedSession(email: String, token: String): Boolean =
        validateGoogleEmail(email) && token.isNotBlank()

    fun isSessionValid(session: GoogleAuthSession?, nowEpochMillis: Long): Boolean {
        if (session == null) return false
        if (!isAuthorizedSession(session.email, session.accessToken)) return false
        val expiresAt = session.expiresAtEpochMillis
        if (expiresAt != null && expiresAt <= nowEpochMillis) return false
        return session.scopes.contains(TASKS_SCOPE)
    }

    fun maskToken(token: String): String {
        val trimmed = token.trim()
        if (trimmed.length <= 8) return "****"
        return "${trimmed.take(4)}...${trimmed.takeLast(4)}"
    }

    fun scrubSensitiveText(rawText: String): String =
        rawText
            .replace(GOOGLE_TOKEN_REGEX, "[REDACTED_TOKEN]")
            .replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED_TOKEN]")
            .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")

    fun parseRfc3339ToEpoch(rfcString: String?): Long? {
        if (rfcString.isNullOrBlank()) return null
        return runCatching {
            Instant.parse(rfcString).toEpochMilliseconds()
        }.getOrNull()
    }

    fun formatEpochToRfc3339(epochMillis: Long): String =
        Instant.fromEpochMilliseconds(epochMillis).toString()
}

object GoogleAuthDiagnosticsEngine {
    const val STATUS_CANCELED = 16
    const val STATUS_NETWORK_ERROR = 7

    fun classifySignInFailure(
        explicitStatusCode: Int?,
        rawMessage: String?,
        exceptionType: String,
        appPackageName: String = "com.pulse.accountability",
        scrubber: (String) -> String = GoogleAuthContract::scrubSensitiveText
    ): GoogleAuthDiagnostic {
        val code = explicitStatusCode ?: extractStatusCodeFromMessage(rawMessage)
        return when (code) {
            10 -> GoogleAuthDiagnostic(
                statusCode = 10,
                statusName = "DEVELOPER_ERROR",
                userFacingTitle = "OAuth Client Configuration Mismatch (Code 10)",
                userFacingExplanation = "Google Play Services rejected the sign-in request because the Android OAuth 2.0 Client ID (package $appPackageName + SHA-1) or OAuth Consent Screen is not yet registered in Google Cloud Console.",
                remediationStep = "Register an Android OAuth 2.0 Client ID in Google Cloud Console (APIs & Services > Credentials) for $appPackageName with debug SHA-1 B5:C2:92:ED:7B:F6:BC:30:C1:0F:F3:69:28:75:96:3B:17:B0:BF:E9.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to "10",
                    "auth_error_name" to "DEVELOPER_ERROR",
                    "exception_type" to exceptionType
                )
            )
            12500 -> GoogleAuthDiagnostic(
                statusCode = 12500,
                statusName = "SIGN_IN_FAILED",
                userFacingTitle = "OAuth Consent Screen Incomplete (Code 12500)",
                userFacingExplanation = "Google Play Services could not complete the sign-in handshake because the OAuth Consent Screen in Google Cloud Console is missing a support email, test user, or the Tasks scope.",
                remediationStep = "In Google Cloud Console > OAuth consent screen, add your Google account as a Test User and ensure https://www.googleapis.com/auth/tasks is listed.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to "12500",
                    "auth_error_name" to "SIGN_IN_FAILED",
                    "exception_type" to exceptionType
                )
            )
            12501, STATUS_CANCELED -> GoogleAuthDiagnostic(
                statusCode = code,
                statusName = "SIGN_IN_CANCELED",
                userFacingTitle = "Sign-In Sheet Closed (Code $code)",
                userFacingExplanation = "The Google account picker was dismissed or canceled before completing sign-in (or Play Services aborted due to missing OAuth client registration).",
                remediationStep = "Tap 'Sign In with Google' again, or verify that the Android OAuth Client ID is active in Google Cloud Console.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to code.toString(),
                    "auth_error_name" to "SIGN_IN_CANCELED",
                    "exception_type" to exceptionType
                )
            )
            STATUS_NETWORK_ERROR -> GoogleAuthDiagnostic(
                statusCode = STATUS_NETWORK_ERROR,
                statusName = "NETWORK_ERROR",
                userFacingTitle = "Network Connection Error (Code 7)",
                userFacingExplanation = "Google Play Services could not reach Google's authentication servers.",
                remediationStep = "Check Wi-Fi or cellular connectivity and retry.",
                telemetryAttributes = mapOf(
                    "auth_error_code" to "7",
                    "auth_error_name" to "NETWORK_ERROR",
                    "exception_type" to exceptionType
                )
            )
            else -> {
                val safeMsg = scrubber(rawMessage ?: "Unknown error")
                GoogleAuthDiagnostic(
                    statusCode = code,
                    statusName = "UNCLASSIFIED_AUTH_ERROR",
                    userFacingTitle = "Google Sign-In Error${if (code != null) " (Code $code)" else ""}",
                    userFacingExplanation = "Sign-in did not complete: $safeMsg",
                    remediationStep = "Verify OAuth Client ID and Tasks API scope in Google Cloud Console.",
                    telemetryAttributes = mapOf(
                        "auth_error_code" to (code?.toString() ?: "none"),
                        "auth_error_name" to "UNCLASSIFIED_AUTH_ERROR",
                        "exception_type" to exceptionType
                    )
                )
            }
        }
    }

    fun extractStatusCodeFromMessage(message: String?): Int? {
        if (message.isNullOrBlank()) return null
        val match = Regex("^(\\d+):").find(message.trim())
            ?: Regex("\\b(10|12500|12501|16|7)\\b").find(message)
        return match?.groupValues?.getOrNull(1)?.toIntOrNull()
    }
}

interface GoogleTasksProvider {
    suspend fun fetchTaskLists(accessToken: String): Result<List<GoogleTaskListDto>>
    suspend fun fetchTasksForList(
        accessToken: String,
        taskListId: String = "@default"
    ): Result<List<GoogleTaskDto>>
    suspend fun createOrUpdateTask(
        accessToken: String,
        taskListId: String = "@default",
        googleTaskId: String? = null,
        title: String,
        notes: String,
        isCompleted: Boolean,
        dueEpochMillis: Long?
    ): Result<GoogleTaskDto>
}

class FakeGoogleOAuthProvider(
    private val nowEpochMillis: Long = 1_762_992_000_000L
) {
    private var currentSession: GoogleAuthSession? = null

    fun signIn(email: String = "alex.rivera@example.com"): Result<GoogleAuthSession> = runCatching {
        require(GoogleAuthContract.validateGoogleEmail(email)) { "10: Invalid Google account email" }
        val slug = email.substringBefore("@").replace(Regex("[^A-Za-z0-9]"), "_")
        val session = GoogleAuthSession(
            email = email,
            accessToken = "ya29.fake_deterministic_token_$slug",
            expiresAtEpochMillis = nowEpochMillis + 3_600_000L,
            scopes = listOf(GoogleAuthContract.TASKS_SCOPE)
        )
        currentSession = session
        session
    }

    fun getCurrentSession(): GoogleAuthSession? = currentSession

    fun revoke() {
        currentSession = null
    }
}

/**
 * Deterministic in-memory fake Google Tasks provider requiring zero real Google credentials.
 */
class FakeGoogleTasksProvider(
    private val nowEpochMillis: Long = 1_762_992_000_000L
) : GoogleTasksProvider {
    private val taskLists = listOf(
        GoogleTaskListDto(id = "@default", title = "My Tasks"),
        GoogleTaskListDto(id = "work-list", title = "Work Priorities")
    )

    private val tasksByList = mutableMapOf(
        "@default" to mutableListOf(
            GoogleTaskDto(
                id = "gtask-1",
                title = "Ship Q4 architecture review",
                notes = "Include zero-PII observability checklist",
                status = "needsAction",
                due = GoogleAuthContract.formatEpochToRfc3339(nowEpochMillis + 86_400_000L),
                updated = GoogleAuthContract.formatEpochToRfc3339(nowEpochMillis)
            ),
            GoogleTaskDto(
                id = "gtask-2",
                title = "Consolidate Q3 expense receipts",
                notes = "Export CSV for finance",
                status = "needsAction",
                due = GoogleAuthContract.formatEpochToRfc3339(nowEpochMillis - 172_800_000L),
                updated = GoogleAuthContract.formatEpochToRfc3339(nowEpochMillis)
            )
        )
    )

    private fun validateTokenOrThrow(accessToken: String) {
        val trimmed = accessToken.trim()
        if (trimmed.isEmpty() || trimmed == "expired-token") {
            throw IllegalStateException("Google Tasks API HTTP 401: Unauthorized")
        }
        if (trimmed == "scope-insufficient-token") {
            throw IllegalStateException("Google Tasks API HTTP 403: ACCESS_TOKEN_SCOPE_INSUFFICIENT")
        }
    }

    override suspend fun fetchTaskLists(accessToken: String): Result<List<GoogleTaskListDto>> =
        runCatching {
            validateTokenOrThrow(accessToken)
            taskLists.toList()
        }

    override suspend fun fetchTasksForList(
        accessToken: String,
        taskListId: String
    ): Result<List<GoogleTaskDto>> = runCatching {
        validateTokenOrThrow(accessToken)
        tasksByList[taskListId]?.toList() ?: emptyList()
    }

    override suspend fun createOrUpdateTask(
        accessToken: String,
        taskListId: String,
        googleTaskId: String?,
        title: String,
        notes: String,
        isCompleted: Boolean,
        dueEpochMillis: Long?
    ): Result<GoogleTaskDto> = runCatching {
        validateTokenOrThrow(accessToken)
        val list = tasksByList.getOrPut(taskListId) { mutableListOf() }
        val nowIso = GoogleAuthContract.formatEpochToRfc3339(nowEpochMillis)
        val dueIso = dueEpochMillis?.let(GoogleAuthContract::formatEpochToRfc3339)
        val status = if (isCompleted) "completed" else "needsAction"
        val cleanNotes = notes.ifBlank { null }

        if (!googleTaskId.isNullOrBlank()) {
            val updated = GoogleTaskDto(
                id = googleTaskId,
                title = title,
                notes = cleanNotes,
                status = status,
                due = dueIso,
                completed = if (isCompleted) nowIso else null,
                updated = nowIso
            )
            val idx = list.indexOfFirst { it.id == googleTaskId }
            if (idx >= 0) {
                list[idx] = updated
            } else {
                list.add(updated)
            }
            updated
        } else {
            val created = GoogleTaskDto(
                id = "gtask-${list.size + 1}",
                title = title,
                notes = cleanNotes,
                status = status,
                due = dueIso,
                completed = if (isCompleted) nowIso else null,
                updated = nowIso
            )
            list.add(created)
            created
        }
    }
}
