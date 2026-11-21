package com.pulse.kmp.telemetry

import com.pulse.kmp.domain.PulseObservability
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

/**
 * Pure Kotlin Multiplatform Zero-PII production observability baseline (`STE-37` / `RFC-0004`)
 * and deterministic feature flags & experimentation evaluator (`STE-57`).
 *
 * Strictly adheres to ADR-008 (`commonMain` purity: zero `java.time.*`, `java.util.UUID`, or `android.*` imports).
 */
object ZeroPiiTelemetry {

    enum class LogLevel {
        DEBUG,
        INFO,
        WARN,
        ERROR
    }

    private val JWT_REGEX = Regex("\\beyJ[A-Za-z0-9_-]{8,}\\.eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b")
    private val SENSITIVE_QUERY_PARAM_REGEX = Regex(
        "([?&](?:access_token|id_token|refresh_token|token|api_key|apikey|password|secret|client_secret|code)=)([^&#\\s]+)",
        RegexOption.IGNORE_CASE
    )
    private val SENSITIVE_KEY_REGEX = Regex(
        "^(?:authorization|cookie|set-cookie|x-api-key|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|token|password|secret|client[-_]?secret|email|raw[-_]?email|ssn|phone)$",
        RegexOption.IGNORE_CASE
    )
    private val TRACEPARENT_REGEX = Regex("^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$", RegexOption.IGNORE_CASE)

    data class TraceContext(
        val traceId: String,
        val spanId: String,
        val sampled: Boolean,
        val traceparent: String
    )

    data class StructuredLogEntry(
        val timestampEpochMillis: Long,
        val level: LogLevel,
        val service: String,
        val event: String,
        val message: String,
        val traceId: String? = null,
        val spanId: String? = null,
        val pseudonymizedUserId: String? = null,
        val attributes: Map<String, String> = emptyMap()
    )

    data class RedMetricSample(
        val timestampEpochMillis: Long,
        val service: String,
        val route: String,
        val method: String,
        val statusCode: Int,
        val durationMs: Double,
        val isError: Boolean,
        val traceId: String? = null
    )

    data class ErrorReportEntry(
        val timestampEpochMillis: Long,
        val service: String,
        val errorType: String,
        val message: String,
        val traceId: String? = null,
        val pseudonymizedUserId: String? = null,
        val attributes: Map<String, String> = emptyMap()
    )

    data class SloWindowEvaluation(
        val totalRequests: Int,
        val successfulRequests: Int,
        val errorRequests: Int,
        val fastRequests: Int,
        val availabilityRatio: Double,
        val latencyTargetRatio: Double,
        val p50LatencyMs: Double,
        val p95LatencyMs: Double,
        val p99LatencyMs: Double,
        val targetAvailability: Double,
        val targetLatencyMs: Double,
        val targetLatencyRatio: Double,
        val errorBudgetRemainingRatio: Double,
        val passesSlo: Boolean
    )

    fun scrubText(input: String): String =
        PulseObservability.scrubSensitiveText(input)
            .replace(JWT_REGEX, "[REDACTED_JWT]")
            .replace(SENSITIVE_QUERY_PARAM_REGEX, "$1[REDACTED_PARAM]")

    fun scrubHeaders(headers: Map<String, String>): Map<String, String> =
        headers.entries.associate { (rawKey, rawValue) ->
            val key = scrubText(rawKey.trim())
            val value = if (SENSITIVE_KEY_REGEX.matches(key)) {
                "[REDACTED_HEADER]"
            } else {
                scrubText(rawValue)
            }
            key to value
        }

    fun scrubAttributes(attributes: Map<String, String>): Map<String, String> =
        attributes.entries
            .mapNotNull { (rawKey, rawValue) ->
                val key = scrubText(rawKey.trim())
                if (key.isEmpty()) {
                    null
                } else {
                    val value = if (SENSITIVE_KEY_REGEX.matches(key)) {
                        "[REDACTED]"
                    } else {
                        scrubText(rawValue)
                    }
                    key to value
                }
            }
            .toMap()

    fun pseudonymizeUser(rawUserId: String?): String =
        if (rawUserId.isNullOrBlank()) "anonymous" else PulseObservability.pseudonymizeIdentifier(rawUserId)

    private fun isValidNonZeroHex(value: String, expectedLength: Int): Boolean =
        value.length == expectedLength &&
            value.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' } &&
            value.any { it != '0' }

    fun formatTraceparent(traceId: String, spanId: String, sampled: Boolean = true): String {
        val normalizedTrace = traceId.lowercase()
        val normalizedSpan = spanId.lowercase()
        require(isValidNonZeroHex(normalizedTrace, 32)) {
            "Invalid W3C traceId: expected 32 non-zero hex chars"
        }
        require(isValidNonZeroHex(normalizedSpan, 16)) {
            "Invalid W3C spanId: expected 16 non-zero hex chars"
        }
        val flags = if (sampled) "01" else "00"
        return "00-$normalizedTrace-$normalizedSpan-$flags"
    }

    fun parseTraceparent(header: String?): TraceContext? {
        if (header.isNullOrBlank()) return null
        val match = TRACEPARENT_REGEX.matchEntire(header.trim()) ?: return null
        val traceId = match.groupValues[1].lowercase()
        val spanId = match.groupValues[2].lowercase()
        val flagsByte = match.groupValues[3].toIntOrNull(16) ?: return null
        if (!isValidNonZeroHex(traceId, 32) || !isValidNonZeroHex(spanId, 16)) return null
        val sampled = (flagsByte and 0x01) == 0x01
        return TraceContext(
            traceId = traceId,
            spanId = spanId,
            sampled = sampled,
            traceparent = formatTraceparent(traceId, spanId, sampled)
        )
    }

    fun createStructuredLog(
        service: String,
        level: LogLevel,
        event: String,
        message: String,
        timestampEpochMillis: Long = 0L,
        traceId: String? = null,
        spanId: String? = null,
        rawUserId: String? = null,
        attributes: Map<String, String> = emptyMap()
    ): StructuredLogEntry =
        StructuredLogEntry(
            timestampEpochMillis = timestampEpochMillis,
            level = level,
            service = scrubText(service.trim().ifEmpty { "pulse-kmp" }),
            event = scrubText(event.trim().ifEmpty { "app.log" }),
            message = scrubText(message),
            traceId = traceId?.let(::scrubText),
            spanId = spanId?.let(::scrubText),
            pseudonymizedUserId = rawUserId?.let(::pseudonymizeUser),
            attributes = scrubAttributes(attributes)
        )

    fun createRedMetricSample(
        service: String,
        route: String,
        method: String,
        statusCode: Int,
        durationMs: Double,
        timestampEpochMillis: Long = 0L,
        traceId: String? = null
    ): RedMetricSample =
        RedMetricSample(
            timestampEpochMillis = timestampEpochMillis,
            service = scrubText(service.trim().ifEmpty { "pulse-kmp" }),
            route = scrubText(route.trim().ifEmpty { "/" }),
            method = method.trim().uppercase().ifEmpty { "GET" },
            statusCode = statusCode,
            durationMs = round(max(0.0, durationMs) * 100.0) / 100.0,
            isError = statusCode >= 500,
            traceId = traceId?.let(::scrubText)
        )

    fun createErrorReport(
        service: String,
        errorType: String,
        message: String,
        timestampEpochMillis: Long = 0L,
        traceId: String? = null,
        rawUserId: String? = null,
        attributes: Map<String, String> = emptyMap()
    ): ErrorReportEntry =
        ErrorReportEntry(
            timestampEpochMillis = timestampEpochMillis,
            service = scrubText(service.trim().ifEmpty { "pulse-kmp" }),
            errorType = scrubText(errorType.trim().ifEmpty { "Exception" }),
            message = scrubText(message),
            traceId = traceId?.let(::scrubText),
            pseudonymizedUserId = rawUserId?.let(::pseudonymizeUser),
            attributes = scrubAttributes(attributes)
        )

    private fun percentile(sorted: List<Double>, p: Int): Double {
        if (sorted.isEmpty()) return 0.0
        val idx = min(sorted.size - 1, max(0, ceil((p / 100.0) * sorted.size).toInt() - 1))
        return round(sorted[idx] * 100.0) / 100.0
    }

    fun evaluateSloWindow(
        samples: List<RedMetricSample>,
        targetAvailability: Double = 0.995,
        targetLatencyMs: Double = 300.0,
        targetLatencyRatio: Double = 0.995
    ): SloWindowEvaluation {
        val total = samples.size
        if (total == 0) {
            return SloWindowEvaluation(
                totalRequests = 0,
                successfulRequests = 0,
                errorRequests = 0,
                fastRequests = 0,
                availabilityRatio = 1.0,
                latencyTargetRatio = 1.0,
                p50LatencyMs = 0.0,
                p95LatencyMs = 0.0,
                p99LatencyMs = 0.0,
                targetAvailability = targetAvailability,
                targetLatencyMs = targetLatencyMs,
                targetLatencyRatio = targetLatencyRatio,
                errorBudgetRemainingRatio = 1.0,
                passesSlo = true
            )
        }

        val successful = samples.count { !it.isError && it.statusCode < 500 }
        val fast = samples.count { it.durationMs <= targetLatencyMs }
        val sortedDurations = samples.map { max(0.0, it.durationMs) }.sorted()

        val errors = total - successful
        val availability = successful.toDouble() / total.toDouble()
        val latencyRatio = fast.toDouble() / total.toDouble()

        val allowedErrorRatio = max(1e-9, 1.0 - targetAvailability)
        val actualErrorRatio = errors.toDouble() / total.toDouble()
        val budgetRemaining = min(1.0, max(0.0, 1.0 - (actualErrorRatio / allowedErrorRatio)))

        val passes = availability >= targetAvailability && latencyRatio >= targetLatencyRatio

        return SloWindowEvaluation(
            totalRequests = total,
            successfulRequests = successful,
            errorRequests = errors,
            fastRequests = fast,
            availabilityRatio = round(availability * 10000.0) / 10000.0,
            latencyTargetRatio = round(latencyRatio * 10000.0) / 10000.0,
            p50LatencyMs = percentile(sortedDurations, 50),
            p95LatencyMs = percentile(sortedDurations, 95),
            p99LatencyMs = percentile(sortedDurations, 99),
            targetAvailability = targetAvailability,
            targetLatencyMs = targetLatencyMs,
            targetLatencyRatio = targetLatencyRatio,
            errorBudgetRemainingRatio = round(budgetRemaining * 10000.0) / 10000.0,
            passesSlo = passes
        )
    }
}

/**
 * Pure Kotlin Multiplatform feature flags & experimentation evaluator (`STE-57`)
 * wired with Zero-PII exposure and outcome logging (`ZeroPiiTelemetry`).
 */
object PulseFlagsAndExperimentEngine {

    enum class EvaluationReason {
        KILL_SWITCH,
        LOCAL_OVERRIDE,
        ALLOWLIST,
        PERCENTAGE_ROLLOUT,
        DEFAULT
    }

    data class FeatureFlagDefinition(
        val key: String,
        val description: String,
        val defaultEnabled: Boolean,
        val killSwitch: Boolean = false,
        val rolloutPercentage: Int? = null,
        val allowlistPseudonymizedUsers: Set<String> = emptySet()
    )

    data class ExperimentVariant(
        val name: String,
        val weight: Int
    )

    data class ExperimentDefinition(
        val key: String,
        val description: String,
        val controlVariant: String = "control",
        val killSwitch: Boolean = false,
        val variants: List<ExperimentVariant> = emptyList()
    )

    data class FlagEvaluationResult(
        val flagKey: String,
        val enabled: Boolean,
        val reason: EvaluationReason,
        val bucket: Int,
        val pseudonymizedUserId: String,
        val exposureLog: ZeroPiiTelemetry.StructuredLogEntry
    )

    data class ExperimentAssignment(
        val experimentKey: String,
        val variant: String,
        val reason: EvaluationReason,
        val bucket: Int,
        val pseudonymizedUserId: String,
        val exposureLog: ZeroPiiTelemetry.StructuredLogEntry
    )

    /**
     * Deterministic FNV-1a 64-bit bucket in `0..99` keyed by `(scopeKey, pseudonymizedUserId)`.
     */
    fun computeDeterministicBucket(scopeKey: String, rawUserId: String?): Pair<String, Int> {
        val pseudoId = ZeroPiiTelemetry.pseudonymizeUser(rawUserId)
        val composite = "${scopeKey.trim()}::$pseudoId"
        var hash = -0x340d631b7bdddcdbL
        for (ch in composite) {
            hash = hash xor ch.code.toLong()
            hash *= 0x100000001b3L
        }
        val bucket = (hash.toULong() % 100uL).toInt()
        return pseudoId to bucket
    }

    fun evaluateFlag(
        definition: FeatureFlagDefinition?,
        flagKey: String,
        rawUserId: String? = null,
        defaultValue: Boolean = false,
        overrides: Map<String, Boolean> = emptyMap(),
        service: String = "pulse-kmp",
        timestampEpochMillis: Long = 0L,
        traceId: String? = null
    ): FlagEvaluationResult {
        val (pseudoId, bucket) = computeDeterministicBucket(flagKey, rawUserId)

        val (enabled, reason) = when {
            definition?.killSwitch == true -> false to EvaluationReason.KILL_SWITCH
            overrides.containsKey(flagKey) -> (overrides[flagKey] == true) to EvaluationReason.LOCAL_OVERRIDE
            definition != null && definition.allowlistPseudonymizedUsers.contains(pseudoId) ->
                true to EvaluationReason.ALLOWLIST
            definition?.rolloutPercentage != null -> {
                val pct = min(100, max(0, definition.rolloutPercentage))
                val rolledOut = when {
                    pct >= 100 -> true
                    pct <= 0 -> false
                    else -> bucket < pct
                }
                rolledOut to EvaluationReason.PERCENTAGE_ROLLOUT
            }
            else -> (definition?.defaultEnabled ?: defaultValue) to EvaluationReason.DEFAULT
        }

        val exposureLog = ZeroPiiTelemetry.createStructuredLog(
            service = service,
            level = ZeroPiiTelemetry.LogLevel.INFO,
            event = "flag.exposure",
            message = "Evaluated feature flag $flagKey=$enabled",
            timestampEpochMillis = timestampEpochMillis,
            traceId = traceId,
            rawUserId = rawUserId,
            attributes = mapOf(
                "flagKey" to flagKey,
                "enabled" to enabled.toString(),
                "reason" to reason.name,
                "bucket" to bucket.toString()
            )
        )

        return FlagEvaluationResult(
            flagKey = flagKey,
            enabled = enabled,
            reason = reason,
            bucket = bucket,
            pseudonymizedUserId = pseudoId,
            exposureLog = exposureLog
        )
    }

    fun assignExperiment(
        definition: ExperimentDefinition?,
        experimentKey: String,
        rawUserId: String? = null,
        experimentOverrides: Map<String, String> = emptyMap(),
        service: String = "pulse-kmp",
        timestampEpochMillis: Long = 0L,
        traceId: String? = null
    ): ExperimentAssignment {
        val (pseudoId, bucket) = computeDeterministicBucket(experimentKey, rawUserId)
        val control = definition?.controlVariant ?: "control"

        val (variant, reason) = when {
            definition?.killSwitch == true -> control to EvaluationReason.KILL_SWITCH
            experimentOverrides.containsKey(experimentKey) ->
                (experimentOverrides[experimentKey] ?: control) to EvaluationReason.LOCAL_OVERRIDE
            definition == null || definition.variants.isEmpty() -> control to EvaluationReason.DEFAULT
            else -> {
                val totalWeight = definition.variants.sumOf { max(0, it.weight) }
                if (totalWeight <= 0) {
                    control to EvaluationReason.DEFAULT
                } else {
                    val target = (bucket / 100.0) * totalWeight.toDouble()
                    var cumulative = 0.0
                    var chosen = definition.variants.last().name
                    for (candidate in definition.variants) {
                        cumulative += max(0, candidate.weight).toDouble()
                        if (target < cumulative) {
                            chosen = candidate.name
                            break
                        }
                    }
                    chosen to EvaluationReason.PERCENTAGE_ROLLOUT
                }
            }
        }

        val exposureLog = ZeroPiiTelemetry.createStructuredLog(
            service = service,
            level = ZeroPiiTelemetry.LogLevel.INFO,
            event = "experiment.exposure",
            message = "Assigned experiment $experimentKey=$variant",
            timestampEpochMillis = timestampEpochMillis,
            traceId = traceId,
            rawUserId = rawUserId,
            attributes = mapOf(
                "experimentKey" to experimentKey,
                "variant" to variant,
                "reason" to reason.name,
                "bucket" to bucket.toString()
            )
        )

        return ExperimentAssignment(
            experimentKey = experimentKey,
            variant = variant,
            reason = reason,
            bucket = bucket,
            pseudonymizedUserId = pseudoId,
            exposureLog = exposureLog
        )
    }

    fun recordExperimentOutcome(
        experimentKey: String,
        variant: String,
        metricName: String,
        value: Double = 1.0,
        rawUserId: String? = null,
        service: String = "pulse-kmp",
        timestampEpochMillis: Long = 0L,
        traceId: String? = null,
        attributes: Map<String, String> = emptyMap()
    ): ZeroPiiTelemetry.StructuredLogEntry =
        ZeroPiiTelemetry.createStructuredLog(
            service = service,
            level = ZeroPiiTelemetry.LogLevel.INFO,
            event = "experiment.outcome",
            message = "Recorded experiment outcome $experimentKey:$metricName",
            timestampEpochMillis = timestampEpochMillis,
            traceId = traceId,
            rawUserId = rawUserId,
            attributes = attributes + mapOf(
                "experimentKey" to experimentKey,
                "variant" to variant,
                "metricName" to metricName,
                "value" to value.toString()
            )
        )
}
