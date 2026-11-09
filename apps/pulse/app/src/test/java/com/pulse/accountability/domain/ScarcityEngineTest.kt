package com.pulse.accountability.domain

import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskItemEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScarcityEngineTest {

    private fun sampleTask(id: String, isTop3: Boolean = false): TaskItemEntity {
        return TaskItemEntity(
            id = id,
            title = "Task $id",
            commitmentState = if (isTop3) TaskCommitmentState.TODAY_TOP_3.name else TaskCommitmentState.NORMAL.name
        )
    }

    @Test
    fun `evaluatePinAction returns Unpin if candidate is already pinned`() {
        val t1 = sampleTask("1", isTop3 = true)
        val currentTop3 = listOf(t1)

        val decision = ScarcityEngine.evaluatePinAction(currentTop3, t1)
        assertEquals(PinDecision.Unpin, decision)
    }

    @Test
    fun `evaluatePinAction allows pinning when current count is less than 3`() {
        val t1 = sampleTask("1", isTop3 = true)
        val t2 = sampleTask("2", isTop3 = true)
        val currentTop3 = listOf(t1, t2)
        val candidate = sampleTask("3", isTop3 = false)

        val decision = ScarcityEngine.evaluatePinAction(currentTop3, candidate)
        assertEquals(PinDecision.AllowPin, decision)
    }

    @Test
    fun `evaluatePinAction enforces hard scarcity limit when already 3 pinned`() {
        val t1 = sampleTask("1", isTop3 = true)
        val t2 = sampleTask("2", isTop3 = true)
        val t3 = sampleTask("3", isTop3 = true)
        val currentTop3 = listOf(t1, t2, t3)
        val candidate = sampleTask("4", isTop3 = false)

        val decision = ScarcityEngine.evaluatePinAction(currentTop3, candidate)
        assertTrue(decision is PinDecision.SwapRequired)
        val swap = decision as PinDecision.SwapRequired
        assertEquals(3, swap.currentCommitments.size)
    }

    @Test
    fun `executeSwap atomically unpins selected item and pins new item`() {
        val t1 = sampleTask("1", isTop3 = true)
        val t2 = sampleTask("2", isTop3 = true)
        val t3 = sampleTask("3", isTop3 = true)
        val currentTop3 = listOf(t1, t2, t3)
        val candidate = sampleTask("4", isTop3 = false)

        val result = ScarcityEngine.executeSwap(
            currentTop3 = currentTop3,
            toRemove = t2,
            toAdd = candidate
        )

        assertEquals(3, result.newTop3.size)
        assertTrue(result.newTop3.any { it.id == "4" })
        assertTrue(result.newTop3.none { it.id == "2" })
        assertEquals(TaskCommitmentState.NORMAL, result.unpinnedTask.commitment)
        assertEquals(TaskCommitmentState.TODAY_TOP_3, result.pinnedTask.commitment)
    }
}
