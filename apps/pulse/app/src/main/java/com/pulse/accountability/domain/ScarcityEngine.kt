package com.pulse.accountability.domain

import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskItemEntity

sealed interface PinDecision {
    data object AllowPin : PinDecision
    data object Unpin : PinDecision
    data class SwapRequired(val currentCommitments: List<TaskItemEntity>) : PinDecision
}

data class SwapResult(
    val unpinnedTask: TaskItemEntity,
    val pinnedTask: TaskItemEntity,
    val newTop3: List<TaskItemEntity>
)

object ScarcityEngine {
    const val MAX_TOP_3_LIMIT = 3

    fun evaluatePinAction(
        currentTop3: List<TaskItemEntity>,
        candidate: TaskItemEntity
    ): PinDecision {
        val isAlreadyPinned = candidate.commitment == TaskCommitmentState.TODAY_TOP_3 ||
                currentTop3.any { it.id == candidate.id }

        if (isAlreadyPinned) {
            return PinDecision.Unpin
        }

        if (currentTop3.size < MAX_TOP_3_LIMIT) {
            return PinDecision.AllowPin
        }

        return PinDecision.SwapRequired(currentCommitments = currentTop3.take(MAX_TOP_3_LIMIT))
    }

    fun executeSwap(
        currentTop3: List<TaskItemEntity>,
        toRemove: TaskItemEntity,
        toAdd: TaskItemEntity,
        nowMillis: Long = System.currentTimeMillis()
    ): SwapResult {
        val unpinned = toRemove.copy(
            commitmentState = TaskCommitmentState.NORMAL.name,
            updatedEpochMillis = nowMillis
        )
        val pinned = toAdd.copy(
            commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
            updatedEpochMillis = nowMillis
        )

        val updatedTop3 = currentTop3
            .filter { it.id != toRemove.id }
            .plus(pinned)
            .take(MAX_TOP_3_LIMIT)

        return SwapResult(
            unpinnedTask = unpinned,
            pinnedTask = pinned,
            newTop3 = updatedTop3
        )
    }
}
