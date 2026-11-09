package com.pulse.accountability.observability

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GoogleAuthDiagnosticsTest {

    @Test
    fun `classifySignInFailure maps code 10 to DEVELOPER_ERROR with SHA-1 remediation`() {
        val ex = RuntimeException("10: ")
        val result = GoogleAuthDiagnostics.classifySignInFailure(ex)

        assertEquals(10, result.statusCode)
        assertEquals("DEVELOPER_ERROR", result.statusName)
        assertTrue(result.userFacingTitle.contains("Code 10"))
        assertTrue(result.remediationStep.contains("B5:C2:92:ED:7B:F6:BC:30:C1:0F:F3:69:28:75:96:3B:17:B0:BF:E9"))
        assertEquals("10", result.telemetryAttributes["auth_error_code"])
    }

    @Test
    fun `classifySignInFailure maps code 12500 to SIGN_IN_FAILED with consent screen remediation`() {
        val ex = RuntimeException("12500: Sign in failed")
        val result = GoogleAuthDiagnostics.classifySignInFailure(ex)

        assertEquals(12500, result.statusCode)
        assertEquals("SIGN_IN_FAILED", result.statusName)
        assertTrue(result.userFacingTitle.contains("Code 12500"))
        assertEquals("12500", result.telemetryAttributes["auth_error_code"])
    }

    @Test
    fun `classifySignInFailure maps code 12501 to SIGN_IN_CANCELED`() {
        val ex = RuntimeException("12501: ")
        val result = GoogleAuthDiagnostics.classifySignInFailure(ex)

        assertEquals(12501, result.statusCode)
        assertEquals("SIGN_IN_CANCELED", result.statusName)
    }

    @Test
    fun `classifySignInFailure scrubs PII on unknown exceptions`() {
        val ex = IllegalStateException("Token failed for stefan@example.com with ya29.secret123")
        val result = GoogleAuthDiagnostics.classifySignInFailure(ex)

        assertEquals("UNCLASSIFIED_AUTH_ERROR", result.statusName)
        assertTrue(result.userFacingExplanation.contains("[REDACTED_EMAIL]"))
        assertTrue(result.userFacingExplanation.contains("[REDACTED_TOKEN]"))
    }
}
