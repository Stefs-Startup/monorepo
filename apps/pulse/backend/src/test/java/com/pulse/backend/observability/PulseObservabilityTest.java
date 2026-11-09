package com.pulse.backend.observability;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PulseObservabilityTest {

    @Test
    void scrubsEmailsAndBearerTokensFromTelemetryLogs() {
        String raw = "Sync failed for stefan@example.com with token Bearer ya29.a0AfH6SMB_secret_token_123";
        String scrubbed = PulseObservability.scrubSensitiveText(raw);

        assertFalse(scrubbed.contains("stefan@example.com"));
        assertFalse(scrubbed.contains("ya29.a0AfH6SMB"));
        assertTrue(scrubbed.contains("[REDACTED_EMAIL]"));
        assertTrue(scrubbed.contains("[REDACTED_TOKEN]"));
    }

    @Test
    void pseudonymizesEmailDeterministically() {
        String id1 = PulseObservability.pseudonymizeIdentifier("Stefan@Example.com ");
        String id2 = PulseObservability.pseudonymizeIdentifier("stefan@example.com");
        assertEquals(id1, id2);
        assertEquals(16, id1.length());
    }

    @Test
    void recordsScrubbedBreadcrumbs() {
        PulseObservability.clearBreadcrumbs();
        var entry = PulseObservability.recordBreadcrumb(
                "oauth_error",
                Map.of("account", "user@domain.org", "header", "Bearer secret999")
        );
        assertTrue(entry.summary().contains("[REDACTED_EMAIL]"));
        assertTrue(entry.summary().contains("[REDACTED_TOKEN]"));
    }
}
