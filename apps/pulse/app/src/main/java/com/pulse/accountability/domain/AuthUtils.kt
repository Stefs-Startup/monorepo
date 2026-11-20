package com.pulse.accountability.domain

import com.stefs.googleauth.GoogleAuthContract

object AuthUtils {
    const val TASKS_SCOPE = GoogleAuthContract.TASKS_SCOPE

    fun formatTasksScope(): String = GoogleAuthContract.formatTasksScope()

    fun validateGoogleEmail(email: String): Boolean =
        GoogleAuthContract.validateGoogleEmail(email)

    fun isAuthorizedSession(email: String, token: String): Boolean =
        GoogleAuthContract.isAuthorizedSession(email, token)

    fun maskToken(token: String): String =
        GoogleAuthContract.maskToken(token)

    fun parseRfc3339ToEpoch(rfcString: String?): Long? =
        GoogleAuthContract.parseRfc3339ToEpoch(rfcString)

    fun formatEpochToRfc3339(epochMillis: Long): String =
        GoogleAuthContract.formatEpochToRfc3339(epochMillis)
}
