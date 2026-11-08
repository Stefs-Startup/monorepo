package com.pulse.accountability.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthUtilsTest {

    @Test
    fun `formatTasksScope builds correct oauth2 scope string`() {
        val result = AuthUtils.formatTasksScope()
        assertEquals("oauth2:https://www.googleapis.com/auth/tasks", result)
    }

    @Test
    fun `validateGoogleEmail validates correct gmail and google workspace emails`() {
        assertTrue(AuthUtils.validateGoogleEmail("stefan@gmail.com"))
        assertTrue(AuthUtils.validateGoogleEmail("user.name+tag@company.com"))
        assertFalse(AuthUtils.validateGoogleEmail("not-an-email"))
        assertFalse(AuthUtils.validateGoogleEmail(""))
        assertFalse(AuthUtils.validateGoogleEmail("   "))
    }

    @Test
    fun `isAuthorizedSession returns true only when both email and token are valid`() {
        assertTrue(AuthUtils.isAuthorizedSession("stefan@gmail.com", "ya29.sample_token_123"))
        assertFalse(AuthUtils.isAuthorizedSession("", "ya29.sample_token_123"))
        assertFalse(AuthUtils.isAuthorizedSession("stefan@gmail.com", ""))
        assertFalse(AuthUtils.isAuthorizedSession("", ""))
    }

    @Test
    fun `maskToken obfuscates token preserving prefix and suffix for safe logging`() {
        val token = "ya29.a0AfH6SMDI_sample_secret_token_xyz987"
        val masked = AuthUtils.maskToken(token)
        assertTrue(masked.startsWith("ya29..."))
        assertTrue(masked.endsWith("z987"))
        assertFalse(masked.contains("sample_secret"))
    }

    @Test
    fun `parseRfc3339ToEpoch and formatEpochToRfc3339 are symmetric`() {
        val timestampStr = "2026-11-02T19:00:00Z"
        val epoch = AuthUtils.parseRfc3339ToEpoch(timestampStr)
        assertNotNull(epoch)

        val formatted = AuthUtils.formatEpochToRfc3339(epoch!!)
        assertEquals(timestampStr, formatted)
    }

    @Test
    fun `parseRfc3339ToEpoch returns null for empty or invalid strings`() {
        assertNull(AuthUtils.parseRfc3339ToEpoch(null))
        assertNull(AuthUtils.parseRfc3339ToEpoch(""))
        assertNull(AuthUtils.parseRfc3339ToEpoch("invalid-date"))
    }
}
