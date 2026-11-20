package com.pulse.kmp.telemetry

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ZeroPiiObservabilityAndFlagsTest {

    @Test
    fun scrubsEmailsTokensJwtsHeadersAndAttributes() {
        val fakeJwt = listOf("eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "c2lnbmF0dXJl123").joinToString(".")
        val fakeOauth = listOf("ya29", "secret_oauth").joinToString(".")
        val raw = "User alice@example.com called /api/v1/pulse?token=sec123 with Bearer $fakeJwt and $fakeOauth"
        val scrubbed = ZeroPiiTelemetry.scrubText(raw)

        assertFalse(scrubbed.contains("alice@example.com"))
        assertFalse(scrubbed.contains("sec123"))
        assertFalse(scrubbed.contains(fakeOauth))
        assertTrue(scrubbed.contains("[REDACTED_EMAIL]"))
        assertTrue(scrubbed.contains("token=[REDACTED_PARAM]"))
        assertTrue(scrubbed.contains("[REDACTED_TOKEN]"))

        val headers = ZeroPiiTelemetry.scrubHeaders(
            mapOf(
                "Authorization" to "Bearer secret-jwt",
                "Cookie" to "sid=123",
                "X-User" to "bob@company.org",
                "Accept" to "application/json"
            )
        )
        assertEquals("[REDACTED_HEADER]", headers["Authorization"])
        assertEquals("[REDACTED_HEADER]", headers["Cookie"])
        assertEquals("[REDACTED_EMAIL]", headers["X-User"])
        assertEquals("application/json", headers["Accept"])
    }

    @Test
    fun parsesAndFormatsW3cTraceparentAndEvaluatesSloWindow() {
        val tp = ZeroPiiTelemetry.formatTraceparent(
            traceId = "4bf92f3577b34da6a3ce929d0e0e4736",
            spanId = "00f067aa0ba902b7",
            sampled = true
        )
        assertEquals("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01", tp)

        val parsed = ZeroPiiTelemetry.parseTraceparent(tp)
        assertNotNull(parsed)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", parsed.traceId)
        assertEquals("00f067aa0ba902b7", parsed.spanId)
        assertTrue(parsed.sampled)
        assertNull(ZeroPiiTelemetry.parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"))

        val samples = (0 until 200).map { idx ->
            ZeroPiiTelemetry.createRedMetricSample(
                service = "pulse-kmp",
                route = "/api/v1/pulse/state",
                method = "GET",
                statusCode = if (idx == 0) 503 else 200,
                durationMs = if (idx == 0) 420.0 else 95.0
            )
        }
        val slo = ZeroPiiTelemetry.evaluateSloWindow(samples)
        assertEquals(200, slo.totalRequests)
        assertEquals(0.995, slo.availabilityRatio)
        assertEquals(0.995, slo.latencyTargetRatio)
        assertTrue(slo.passesSlo)
    }

    @Test
    fun evaluatesFeatureFlagsKillSwitchRolloutsAndZeroPiiExperimentTelemetry() {
        val killedDef = PulseFlagsAndExperimentEngine.FeatureFlagDefinition(
            key = "pulse.live-stream",
            description = "Killed flag",
            defaultEnabled = true,
            killSwitch = true,
            rolloutPercentage = 100
        )
        val killedRes = PulseFlagsAndExperimentEngine.evaluateFlag(
            definition = killedDef,
            flagKey = "pulse.live-stream",
            rawUserId = "alice@example.com",
            overrides = mapOf("pulse.live-stream" to true)
        )
        assertFalse(killedRes.enabled)
        assertEquals(PulseFlagsAndExperimentEngine.EvaluationReason.KILL_SWITCH, killedRes.reason)
        assertFalse(killedRes.exposureLog.toString().contains("alice@example.com"))

        val rolloutDef = PulseFlagsAndExperimentEngine.FeatureFlagDefinition(
            key = "pulse-coach",
            description = "50% rollout",
            defaultEnabled = false,
            rolloutPercentage = 50
        )
        val evalA = PulseFlagsAndExperimentEngine.evaluateFlag(
            definition = rolloutDef,
            flagKey = "pulse-coach",
            rawUserId = "Founder@Company.com"
        )
        val evalB = PulseFlagsAndExperimentEngine.evaluateFlag(
            definition = rolloutDef,
            flagKey = "pulse-coach",
            rawUserId = "founder@company.com "
        )
        assertEquals(evalA.enabled, evalB.enabled)
        assertEquals(evalA.bucket, evalB.bucket)
        assertEquals(PulseFlagsAndExperimentEngine.EvaluationReason.PERCENTAGE_ROLLOUT, evalA.reason)

        val expDef = PulseFlagsAndExperimentEngine.ExperimentDefinition(
            key = "exp.micro-starter-copy",
            description = "A/B test micro starter prompt",
            controlVariant = "control",
            variants = listOf(
                PulseFlagsAndExperimentEngine.ExperimentVariant("control", 50),
                PulseFlagsAndExperimentEngine.ExperimentVariant("action_5m", 50)
            )
        )
        val assignment = PulseFlagsAndExperimentEngine.assignExperiment(
            definition = expDef,
            experimentKey = "exp.micro-starter-copy",
            rawUserId = "founder@company.com"
        )
        assertTrue(assignment.variant == "control" || assignment.variant == "action_5m")
        assertEquals("experiment.exposure", assignment.exposureLog.event)
        assertFalse(assignment.exposureLog.toString().contains("founder@company.com"))

        val outcome = PulseFlagsAndExperimentEngine.recordExperimentOutcome(
            experimentKey = "exp.micro-starter-copy",
            variant = assignment.variant,
            metricName = "triage.shrink_5m",
            value = 1.0,
            rawUserId = "founder@company.com",
            attributes = mapOf("email" to "founder@company.com")
        )
        assertEquals("experiment.outcome", outcome.event)
        assertEquals("[REDACTED]", outcome.attributes["email"])
        assertFalse(outcome.toString().contains("founder@company.com"))
    }
}
