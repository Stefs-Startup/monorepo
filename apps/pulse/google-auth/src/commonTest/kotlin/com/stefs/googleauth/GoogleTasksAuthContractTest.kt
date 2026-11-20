package com.stefs.googleauth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GoogleTasksAuthContractTest {

    @Test
    fun `validates Google OAuth scopes emails sessions and masks tokens`() {
        assertEquals("oauth2:https://www.googleapis.com/auth/tasks", GoogleAuthContract.formatTasksScope())
        assertTrue(GoogleAuthContract.validateGoogleEmail("stefan@gmail.com"))
        assertTrue(GoogleAuthContract.validateGoogleEmail("user.name+tag@company.com"))
        assertFalse(GoogleAuthContract.validateGoogleEmail("not-an-email"))
        assertFalse(GoogleAuthContract.validateGoogleEmail(""))

        val sampleToken = listOf("ya29", "sample_token_123").joinToString(".")
        assertTrue(GoogleAuthContract.isAuthorizedSession("stefan@gmail.com", sampleToken))
        assertFalse(GoogleAuthContract.isAuthorizedSession("", sampleToken))
        assertFalse(GoogleAuthContract.isAuthorizedSession("stefan@gmail.com", ""))

        val masked = GoogleAuthContract.maskToken(listOf("ya29", "a0AfH6SMDI_sample_secret_token_xyz987").joinToString("."))
        assertEquals("ya29...z987", masked)
        assertEquals("****", GoogleAuthContract.maskToken("short"))
    }

    @Test
    fun `parses and formats RFC 3339 timestamps symmetrically`() {
        val timestampStr = "2026-11-02T19:00:00Z"
        val epoch = GoogleAuthContract.parseRfc3339ToEpoch(timestampStr)
        assertNotNull(epoch)
        assertEquals(timestampStr, GoogleAuthContract.formatEpochToRfc3339(epoch))
        assertNull(GoogleAuthContract.parseRfc3339ToEpoch(null))
        assertNull(GoogleAuthContract.parseRfc3339ToEpoch(""))
        assertNull(GoogleAuthContract.parseRfc3339ToEpoch("invalid-date"))
    }

    @Test
    fun `classifies Google Sign-In failure codes and scrubs PII`() {
        val code10 = GoogleAuthDiagnosticsEngine.classifySignInFailure(
            explicitStatusCode = null,
            rawMessage = "10: ",
            exceptionType = "RuntimeException"
        )
        assertEquals(10, code10.statusCode)
        assertEquals("DEVELOPER_ERROR", code10.statusName)

        val code12500 = GoogleAuthDiagnosticsEngine.classifySignInFailure(
            explicitStatusCode = null,
            rawMessage = "12500: Sign in failed",
            exceptionType = "RuntimeException"
        )
        assertEquals(12500, code12500.statusCode)
        assertEquals("SIGN_IN_FAILED", code12500.statusName)

        val syntheticToken = listOf("ya29", "secret123").joinToString(".")
        val unknown = GoogleAuthDiagnosticsEngine.classifySignInFailure(
            explicitStatusCode = null,
            rawMessage = "Token failed for stefan@example.com with $syntheticToken",
            exceptionType = "IllegalStateException"
        )
        assertEquals("UNCLASSIFIED_AUTH_ERROR", unknown.statusName)
        assertTrue(unknown.userFacingExplanation.contains("[REDACTED_EMAIL]"))
        assertTrue(unknown.userFacingExplanation.contains("[REDACTED_TOKEN]"))
    }

    @Test
    fun `fake Google OAuth provider works deterministically with zero real credentials`() {
        val nowMs = 1_762_992_000_000L
        val oauth = FakeGoogleOAuthProvider(nowEpochMillis = nowMs)
        val session = oauth.signIn("alex.rivera@example.com").getOrThrow()
        assertTrue(GoogleAuthContract.isSessionValid(session, nowMs))
        assertFalse(GoogleAuthContract.isSessionValid(session, nowMs + 7_200_000L))
        oauth.revoke()
        assertNull(oauth.getCurrentSession())
    }
}
