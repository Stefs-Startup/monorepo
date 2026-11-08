package com.pulse.accountability.domain

import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class UndoneAccountabilityEngineTest {

    private val today = LocalDate.of(2026, 11, 5)
    private val zone = ZoneOffset.UTC
    private val nowMillis = today.atStartOfDay(zone).toInstant().toEpochMilli()

    private fun makeTask(
        id: String,
        title: String,
        deferCount: Int = 0,
        daysOld: Long = 1,
        daysUntouched: Long = 0,
        dueDaysOffset: Long? = null,
        commitment: TaskCommitmentState = TaskCommitmentState.NORMAL,
        isCompleted: Boolean = false
    ): TaskItemEntity {
        val createdMillis = today.minusDays(daysOld).atStartOfDay(zone).toInstant().toEpochMilli()
        val updatedMillis = today.minusDays(daysUntouched).atStartOfDay(zone).toInstant().toEpochMilli()
        val dueMillis = dueDaysOffset?.let { today.plusDays(it).atStartOfDay(zone).toInstant().toEpochMilli() }

        return TaskItemEntity(
            id = id,
            title = title,
            isCompleted = isCompleted,
            deferCount = deferCount,
            createdEpochMillis = createdMillis,
            updatedEpochMillis = updatedMillis,
            dueEpochMillis = dueMillis,
            commitmentState = commitment.name,
            energyLevel = TaskEnergyLevel.FOCUSED.name
        )
    }

    @Test
    fun `classifies task with 2 or more deferrals as HABITUALLY_DEFERRED`() {
        val task = makeTask(id = "1", title = "Schedule annual bloodwork", deferCount = 3, daysOld = 9)
        val status = UndoneAccountabilityEngine.classifyTask(task, today, nowMillis, zone)

        assertEquals(AccountabilityCategory.HABITUALLY_DEFERRED, status.category)
        assertTrue(status.badgeLabel.contains("Deferred 3×"))
    }

    @Test
    fun `classifies task untouched for 5+ days or overdue by 3+ days as LONG_STANDING_GHOSTED`() {
        val untouchedTask = makeTask(id = "2", title = "Submit dental claim", deferCount = 0, daysOld = 14, daysUntouched = 8)
        val status1 = UndoneAccountabilityEngine.classifyTask(untouchedTask, today, nowMillis, zone)
        assertEquals(AccountabilityCategory.LONG_STANDING_GHOSTED, status1.category)
        assertTrue(status1.badgeLabel.contains("8d untouched"))

        val overdueTask = makeTask(id = "3", title = "File taxes", deferCount = 0, daysOld = 10, daysUntouched = 1, dueDaysOffset = -4)
        val status2 = UndoneAccountabilityEngine.classifyTask(overdueTask, today, nowMillis, zone)
        assertEquals(AccountabilityCategory.LONG_STANDING_GHOSTED, status2.category)
        assertTrue(status2.badgeLabel.contains("4d overdue"))
    }

    @Test
    fun `classifies pinned task as ACTIVE_COMMITTED`() {
        val pinned = makeTask(id = "4", title = "Finalize Q4 architecture deck", commitment = TaskCommitmentState.TODAY_TOP_3)
        val status = UndoneAccountabilityEngine.classifyTask(pinned, today, nowMillis, zone)
        assertEquals(AccountabilityCategory.ACTIVE_COMMITTED, status.category)
    }

    @Test
    fun `generates initial conversational prompt tailored to habitual deferral vs ghosted age`() {
        val deferredTask = makeTask(id = "1", title = "Schedule bloodwork", deferCount = 4, daysOld = 9)
        val opening = UndoneAccountabilityEngine.buildInitialReflectionThread(deferredTask, today, nowMillis, zone)

        assertEquals(1, opening.size)
        assertEquals(ChatRole.PARTNER, opening[0].role)
        assertTrue(opening[0].text.contains("Schedule bloodwork"))
        assertTrue(opening[0].text.contains("4 times"))
    }

    @Test
    fun `generates empathetic actionable partner reply when user expresses blocker or selects quick reply`() {
        val task = makeTask(id = "1", title = "Schedule bloodwork", deferCount = 4, daysOld = 9)

        val replyTooBig = UndoneAccountabilityEngine.generatePartnerReply(
            task = task,
            userMessage = "It feels too big and I don't have the clinic number handy"
        )
        assertEquals(ChatRole.PARTNER, replyTooBig.role)
        assertTrue(replyTooBig.text.contains("5-minute") || replyTooBig.text.contains("smaller"))
        assertEquals(TriageAction.ShrinkTo5m, replyTooBig.suggestedAction)

        val replyDrop = UndoneAccountabilityEngine.generatePartnerReply(
            task = task,
            userMessage = "Honestly this is not a priority anymore"
        )
        assertEquals(TriageAction.DropConsciously, replyDrop.suggestedAction)
    }
}
