package com.pulse.kmp.api

import com.pulse.kmp.api.generated.ApiErrorResponse
import com.pulse.kmp.api.generated.PulseDashboardResponse
import com.pulse.kmp.api.generated.SwapTop3Request
import com.pulse.kmp.api.generated.TriageRequest
import com.pulse.kmp.domain.AccountabilityCategory
import com.pulse.kmp.domain.KmpTaskItem
import com.pulse.kmp.domain.TaskCommitmentState
import com.pulse.kmp.domain.TaskEnergyLevel
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.pulse.kmp.api.generated.AccountabilityCategory as WireAccountabilityCategory
import com.pulse.kmp.api.generated.TaskCommitmentState as WireCommitmentState
import com.pulse.kmp.api.generated.TaskEnergyLevel as WireEnergyLevel
import com.pulse.kmp.api.generated.TaskItem as WireTaskItem

/**
 * Canonical REST routes matching Spring Boot 4's OpenAPI 3.1 contract (`pulse-api.openapi.json`).
 */
object PulseApiEndpoints {
    const val BASE_PATH = "/api/v1/pulse"
    const val STATE = "$BASE_PATH/state"
    const val SWAP = "$BASE_PATH/tasks/swap"
    const val SETTINGS = "$BASE_PATH/settings"
    const val DEMO_RESET = "$BASE_PATH/demo/reset"

    fun triagePath(taskId: String): String = "$BASE_PATH/tasks/$taskId/triage"
    fun chatPath(taskId: String): String = "$BASE_PATH/tasks/$taskId/chat"
}

/**
 * Shared KMP JSON codec configured for Expand-and-Contract API evolution:
 * - `ignoreUnknownKeys = true` ensures new optional fields added by Spring Boot never crash older KMP/wasmJs clients.
 * - `encodeDefaults = true` preserves explicit contract fields.
 * - `explicitNulls = false` omits unset optional request properties (`waitingOn`, `postponeDays`).
 */
@OptIn(ExperimentalSerializationApi::class)
val PulseApiJson: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
}

/**
 * Anti-Corruption Layer (ACL) bridging generated OpenAPI 3.1 wire DTOs (`com.pulse.kmp.api.generated`)
 * to the pure KMP domain model (`com.pulse.kmp.domain`) without leaking wire drift into core logic.
 */
object PulseApiContractMapper {

    fun decodeDashboardResponse(rawJson: String): PulseDashboardResponse =
        PulseApiJson.decodeFromString(rawJson)

    fun decodeApiError(rawJson: String): ApiErrorResponse =
        PulseApiJson.decodeFromString(rawJson)

    fun encodeTriageRequest(request: TriageRequest): String =
        PulseApiJson.encodeToString(request)

    fun encodeSwapTop3Request(request: SwapTop3Request): String =
        PulseApiJson.encodeToString(request)

    fun toKmpTaskItem(wire: WireTaskItem): KmpTaskItem =
        KmpTaskItem(
            id = wire.id,
            title = wire.title,
            notes = wire.notes,
            isCompleted = wire.isCompleted,
            dueEpochMillis = wire.dueEpochMillis,
            createdEpochMillis = wire.createdEpochMillis,
            updatedEpochMillis = wire.updatedEpochMillis,
            deferCount = wire.deferCount,
            commitment = toKmpCommitment(wire.commitment),
            energy = toKmpEnergy(wire.energy),
            blockerNote = wire.blockerNote
        )

    fun toKmpCommitment(wire: WireCommitmentState): TaskCommitmentState = when (wire) {
        WireCommitmentState.NORMAL -> TaskCommitmentState.NORMAL
        WireCommitmentState.TODAY_TOP_3 -> TaskCommitmentState.TODAY_TOP_3
        WireCommitmentState.DEFERRED_INTENTIONALLY -> TaskCommitmentState.DEFERRED_INTENTIONALLY
        WireCommitmentState.SOMEDAY_PARKED -> TaskCommitmentState.SOMEDAY_PARKED
    }

    fun toKmpEnergy(wire: WireEnergyLevel): TaskEnergyLevel = when (wire) {
        WireEnergyLevel.QUICK_WIN -> TaskEnergyLevel.QUICK_WIN
        WireEnergyLevel.FOCUSED -> TaskEnergyLevel.FOCUSED
        WireEnergyLevel.DEEP_WORK -> TaskEnergyLevel.DEEP_WORK
    }

    fun toKmpCategory(
        wire: WireAccountabilityCategory,
        isCompleted: Boolean,
        commitment: WireCommitmentState
    ): AccountabilityCategory = when (wire) {
        WireAccountabilityCategory.HABITUALLY_DEFERRED -> AccountabilityCategory.HABITUALLY_DEFERRED
        WireAccountabilityCategory.LONG_STANDING_GHOSTED -> AccountabilityCategory.LONG_STANDING_IDLE
        WireAccountabilityCategory.ACTIVE_COMMITTED -> AccountabilityCategory.COMMITTED_TOP_3
        WireAccountabilityCategory.HEALTHY_BACKLOG -> AccountabilityCategory.ACTIVE_FLOW
        WireAccountabilityCategory.COMPLETED_OR_PARKED -> when {
            isCompleted -> AccountabilityCategory.COMPLETED
            commitment == WireCommitmentState.SOMEDAY_PARKED -> AccountabilityCategory.SOMEDAY_PARKED
            else -> AccountabilityCategory.COMPLETED
        }
    }
}
