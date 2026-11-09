package com.pulse.accountability.observability

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PulseObservabilityTest {

    @Test
    fun `pseudonymizeIdentifier returns anonymous for blank input`() {
        assertEquals("anonymous", PulseObservability.pseudonymizeIdentifier(""))
        assertEquals("anonymous", PulseObservability.pseudonymizeIdentifier("   "))
    }

    @Test
    fun `pseudonymizeIdentifier generates deterministic 16-char hex without exposing email`() {
        val hash1 = PulseObservability.pseudonymizeIdentifier("Stefan@Example.com")
        val hash2 = PulseObservability.pseudonymizeIdentifier("stefan@example.com ")
        assertEquals(hash1, hash2)
        assertEquals(16, hash1.length)
        assertFalse(hash1.contains("stefan"))
        assertNotEquals("anonymous", hash1)
    }

    @Test
    fun `scrubSensitiveText redacts email addresses and OAuth bearer tokens`() {
        val raw = "Sync failed for user stefan@gmail.com with token Bearer ya29.a0AfH6SMBx91823 and raw ya29.secret_token_123"
        val scrubbed = PulseObservability.scrubSensitiveText(raw)

        assertFalse(scrubbed.contains("stefan@gmail.com"))
        assertFalse(scrubbed.contains("ya29.a0AfH6SMBx91823"))
        assertFalse(scrubbed.contains("ya29.secret_token_123"))
        assertEquals(
            "Sync failed for user [REDACTED_EMAIL] with token [REDACTED_TOKEN] and raw [REDACTED_TOKEN]",
            scrubbed
        )
    }
}
