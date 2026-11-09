package com.pulse.accountability.domain

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

object AuthUtils {
    const val TASKS_SCOPE = "https://www.googleapis.com/auth/tasks"

    fun formatTasksScope(): String = "oauth2:$TASKS_SCOPE"

    fun validateGoogleEmail(email: String): Boolean {
        val trimmed = email.trim()
        if (trimmed.isEmpty() || !trimmed.contains("@") || !trimmed.contains(".")) return false
        val parts = trimmed.split("@")
        return parts.size == 2 && parts[0].isNotEmpty() && parts[1].length >= 3
    }

    fun isAuthorizedSession(email: String, token: String): Boolean {
        return validateGoogleEmail(email) && token.isNotBlank()
    }

    fun maskToken(token: String): String {
        val trimmed = token.trim()
        if (trimmed.length <= 8) return "****"
        val prefix = trimmed.take(4)
        val suffix = trimmed.takeLast(4)
        return "$prefix...$suffix"
    }

    fun parseRfc3339ToEpoch(rfcString: String?): Long? {
        if (rfcString.isNullOrBlank()) return null
        return runCatching {
            Instant.parse(rfcString).toEpochMilli()
        }.getOrNull()
    }

    fun formatEpochToRfc3339(epochMillis: Long): String {
        return Instant.ofEpochMilli(epochMillis)
            .atOffset(ZoneOffset.UTC)
            .format(DateTimeFormatter.ISO_INSTANT)
    }
}
