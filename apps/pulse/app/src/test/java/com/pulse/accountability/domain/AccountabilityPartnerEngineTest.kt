package com.pulse.accountability.domain

import com.pulse.accountability.data.local.PartnerTone
import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class AccountabilityPartnerEngineTest {

    private val engine = AccountabilityPartnerEngine()
    private val testDate = LocalDate.of(2026, 11, 2)

    private fun sampleTask(
        id: String,
        title: String,
        notes: String = "",
        deferCount: Int = 0,
        dueDaysOffset: Long? = 0L,
        commitmentState: TaskCommitmentState = TaskCommitmentState.NORMAL,
        energyLevel: TaskEnergyLevel = TaskEnergyLevel.FOCUSED
    ) = TaskItemEntity(
        id = id,
        googleTaskId = id,
        taskListId = "test-list",
        taskListTitle = "My Tasks",
        title = title,
        notes = notes,
        dueEpochMillis = dueDaysOffset?.let { testDate.plusDays(it).toEpochDay() * 86_400_000L },
        isCompleted = false,
        deferCount = deferCount,
        commitmentState = commitmentState.name,
        energyLevel = energyLevel.name,
        updatedEpochMillis = testDate.minusDays(1).toEpochDay() * 86_400_000L
    )

    @Test
    fun `empty active tasks returns Clear Horizon briefing`() {
        val briefing = engine.buildDailyBriefing(
            tasks = emptyList(),
            goals = emptyList(),
            tone = PartnerTone.GENTLE_COACH,
            nowTime = LocalTime.of(8, 30),
            today = testDate
        )

        assertEquals("Morning Anchor • Clear Horizon", briefing.headline)
        assertEquals("Review Weekly Compass", briefing.actionHighlight)
    }

    @Test
    fun `chronic deferral triggers unblocking friction briefing with selected tone`() {
        val tasks = listOf(
            sampleTask("1", "Clean workspace", deferCount = 0),
            sampleTask("2", "Renew passport", deferCount = 3)
        )

        val gentle = engine.buildDailyBriefing(tasks, emptyList(), PartnerTone.GENTLE_COACH, LocalTime.of(9, 0), testDate)
        assertTrue(gentle.message.contains("No guilt"))
        assertEquals("2", gentle.suggestedFocusTaskId)

        val direct = engine.buildDailyBriefing(tasks, emptyList(), PartnerTone.DIRECT_PARTNER, LocalTime.of(9, 0), testDate)
        assertTrue(direct.message.contains("Reality check"))
        assertEquals("2", direct.suggestedFocusTaskId)

        val socratic = engine.buildDailyBriefing(tasks, emptyList(), PartnerTone.SOCRATIC_GUIDE, LocalTime.of(9, 0), testDate)
        assertTrue(socratic.message.contains("What is the real friction"))
        assertEquals("2", socratic.suggestedFocusTaskId)
    }

    @Test
    fun `look-ahead preparation triggers when task due in 2 days needs advance setup`() {
        val tasks = listOf(
            sampleTask("1", "Routine daily check", deferCount = 0, dueDaysOffset = 0),
            sampleTask("2", "Client Strategy Presentation", deferCount = 0, dueDaysOffset = 2, energyLevel = TaskEnergyLevel.DEEP_WORK)
        )

        val briefing = engine.buildDailyBriefing(
            tasks = tasks,
            goals = emptyList(),
            tone = PartnerTone.GENTLE_COACH,
            nowTime = LocalTime.of(10, 0),
            today = testDate
        )

        assertTrue(briefing.headline.contains("Look-Ahead Prep"))
        assertEquals("2", briefing.suggestedFocusTaskId)
    }

    @Test
    fun `heuristic prep plan decomposes complex task into actionable micro-steps`() {
        val task = sampleTask(
            id = "tax-1",
            title = "Prepare quarterly financial taxes and filing",
            notes = "Include receipts from stripe and bank statements"
        )
        val plan = engine.buildHeuristicPrepPlan(
            task = task,
            tone = PartnerTone.GENTLE_COACH
        )

        assertNotNull(plan.coachingNote)
        assertTrue(plan.steps.size in 3..4)
        assertTrue(plan.steps.all { it.title.isNotBlank() })
        assertEquals(TaskEnergyLevel.FOCUSED, plan.suggestedEnergy)
    }
}
