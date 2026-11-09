package com.pulse.accountability.domain

import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

class TriageRulesTest {

    private val zone = ZoneId.of("UTC")
    private val today = LocalDate.of(2026, 11, 2)
    private val nowMillis = today.atStartOfDay(zone).toInstant().toEpochMilli()

    @Test
    fun `evaluateTriageEligibility flags overdue task`() {
        val overdueDueMillis = today.minusDays(2).atStartOfDay(zone).toInstant().toEpochMilli()
        val task = TaskItemEntity(
            id = "t1",
            title = "File taxes",
            dueEpochMillis = overdueDueMillis
        )

        val reason = TriageRules.evaluateTriageEligibility(task, today, zone, nowMillis)
        assertNotNull(reason)
        assertTrue(reason is TriageEligibility.Overdue)
        assertEquals(2L, (reason as TriageEligibility.Overdue).daysOverdue)
    }

    @Test
    fun `evaluateTriageEligibility flags chronic deferrals (2 or more)`() {
        val task = TaskItemEntity(
            id = "t2",
            title = "Clean garage",
            deferCount = 3
        )

        val reason = TriageRules.evaluateTriageEligibility(task, today, zone, nowMillis)
        assertNotNull(reason)
        assertTrue(reason is TriageEligibility.ChronicDeferral)
        assertEquals(3, (reason as TriageEligibility.ChronicDeferral).count)
    }

    @Test
    fun `evaluateTriageEligibility flags untouched tasks without due date older than 5 days`() {
        val dayMs = 24 * 60 * 60 * 1000L
        val task = TaskItemEntity(
            id = "t3",
            title = "Call old friend",
            dueEpochMillis = null,
            updatedEpochMillis = nowMillis - (7 * dayMs)
        )

        val reason = TriageRules.evaluateTriageEligibility(task, today, zone, nowMillis)
        assertNotNull(reason)
        assertTrue(reason is TriageEligibility.UntouchedStagnant)
        assertEquals(7L, (reason as TriageEligibility.UntouchedStagnant).daysUntouched)
    }

    @Test
    fun `evaluateTriageEligibility returns null for active healthy task`() {
        val task = TaskItemEntity(
            id = "t4",
            title = "Prepare sprint review",
            dueEpochMillis = today.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(),
            updatedEpochMillis = nowMillis
        )

        val reason = TriageRules.evaluateTriageEligibility(task, today, zone, nowMillis)
        assertNull(reason)
    }

    @Test
    fun `applyTriageAction ShrinkTo5m renames title with 5m starter and commits today`() {
        val task = TaskItemEntity(
            id = "t5",
            title = "Write annual performance reviews",
            energyLevel = TaskEnergyLevel.DEEP_WORK.name
        )

        val updated = TriageRules.applyTriageAction(
            task = task,
            action = TriageAction.ShrinkTo5m,
            today = today,
            zone = zone,
            nowMillis = nowMillis
        )

        assertEquals("5m starter: Write annual performance reviews", updated.title)
        assertEquals(TaskEnergyLevel.QUICK_WIN.name, updated.energyLevel)
        assertEquals(TaskCommitmentState.TODAY_TOP_3, updated.commitment)
        assertEquals(nowMillis, updated.dueEpochMillis)
    }

    @Test
    fun `applyTriageAction Reschedule updates due date and increments deferral counter`() {
        val task = TaskItemEntity(
            id = "t6",
            title = "Change furnace filter",
            deferCount = 1
        )

        val targetDate = today.plusDays(3)
        val updated = TriageRules.applyTriageAction(
            task = task,
            action = TriageAction.Reschedule(targetDate),
            today = today,
            zone = zone,
            nowMillis = nowMillis
        )

        assertEquals(2, updated.deferCount)
        assertEquals(targetDate.atStartOfDay(zone).toInstant().toEpochMilli(), updated.dueEpochMillis)
        assertEquals(TaskCommitmentState.DEFERRED_INTENTIONALLY, updated.commitment)
    }

    @Test
    fun `applyTriageAction Delegate records waiting-on blocker note`() {
        val task = TaskItemEntity(
            id = "t7",
            title = "Sign vendor agreement"
        )

        val updated = TriageRules.applyTriageAction(
            task = task,
            action = TriageAction.Delegate(waitingOn = "Legal Counsel Review"),
            today = today,
            zone = zone,
            nowMillis = nowMillis
        )

        assertEquals("Waiting on: Legal Counsel Review", updated.blockerNote)
    }

    @Test
    fun `applyTriageAction ParkSomeday clears due date and removes from active pressure`() {
        val task = TaskItemEntity(
            id = "t8",
            title = "Learn Rust programming",
            dueEpochMillis = nowMillis
        )

        val updated = TriageRules.applyTriageAction(
            task = task,
            action = TriageAction.ParkSomeday,
            today = today,
            zone = zone,
            nowMillis = nowMillis
        )

        assertNull(updated.dueEpochMillis)
        assertEquals(TaskCommitmentState.SOMEDAY_PARKED, updated.commitment)
    }
}
