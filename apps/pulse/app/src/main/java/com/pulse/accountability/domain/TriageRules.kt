package com.pulse.accountability.domain

import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

sealed interface TriageEligibility {
    data class Overdue(val daysOverdue: Long) : TriageEligibility
    data class ChronicDeferral(val count: Int) : TriageEligibility
    data class UntouchedStagnant(val daysUntouched: Long) : TriageEligibility
}

sealed interface TriageAction {
    data object CommitToday : TriageAction
    data object ShrinkTo5m : TriageAction
    data class Reschedule(val targetDate: LocalDate) : TriageAction
    data class Delegate(val waitingOn: String) : TriageAction
    data object ParkSomeday : TriageAction
    data object DropConsciously : TriageAction
}

object TriageRules {
    private const val STAGNANT_DAYS_THRESHOLD = 5L
    private const val CHRONIC_DEFER_THRESHOLD = 2

    fun evaluateTriageEligibility(
        task: TaskItemEntity,
        today: LocalDate = LocalDate.now(),
        zone: ZoneId = ZoneId.systemDefault(),
        nowMillis: Long = System.currentTimeMillis()
    ): TriageEligibility? {
        if (task.isCompleted || task.commitment == TaskCommitmentState.SOMEDAY_PARKED) {
            return null
        }

        val daysOverdue = task.daysOverdue(today, zone)
        if (daysOverdue > 0) {
            return TriageEligibility.Overdue(daysOverdue)
        }

        if (task.deferCount >= CHRONIC_DEFER_THRESHOLD) {
            return TriageEligibility.ChronicDeferral(task.deferCount)
        }

        if (task.dueEpochMillis == null && task.daysSinceUpdated(nowMillis) >= STAGNANT_DAYS_THRESHOLD) {
            return TriageEligibility.UntouchedStagnant(task.daysSinceUpdated(nowMillis))
        }

        return null
    }

    fun applyTriageAction(
        task: TaskItemEntity,
        action: TriageAction,
        today: LocalDate = LocalDate.now(),
        zone: ZoneId = ZoneId.systemDefault(),
        nowMillis: Long = System.currentTimeMillis()
    ): TaskItemEntity {
        return when (action) {
            is TriageAction.CommitToday -> task.copy(
                commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
                dueEpochMillis = today.atStartOfDay(zone).toInstant().toEpochMilli(),
                updatedEpochMillis = nowMillis,
                dirtySync = true
            )
            is TriageAction.ShrinkTo5m -> {
                val cleanTitle = if (task.title.startsWith("5m starter: ")) {
                    task.title
                } else {
                    "5m starter: ${task.title}"
                }
                task.copy(
                    title = cleanTitle,
                    energyLevel = TaskEnergyLevel.QUICK_WIN.name,
                    commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
                    dueEpochMillis = today.atStartOfDay(zone).toInstant().toEpochMilli(),
                    updatedEpochMillis = nowMillis,
                    dirtySync = true
                )
            }
            is TriageAction.Reschedule -> task.copy(
                deferCount = task.deferCount + 1,
                commitmentState = TaskCommitmentState.DEFERRED_INTENTIONALLY.name,
                dueEpochMillis = action.targetDate.atStartOfDay(zone).toInstant().toEpochMilli(),
                updatedEpochMillis = nowMillis,
                dirtySync = true
            )
            is TriageAction.Delegate -> task.copy(
                blockerNote = "Waiting on: ${action.waitingOn.trim()}",
                commitmentState = TaskCommitmentState.NORMAL.name,
                updatedEpochMillis = nowMillis,
                dirtySync = true
            )
            is TriageAction.ParkSomeday -> task.copy(
                commitmentState = TaskCommitmentState.SOMEDAY_PARKED.name,
                dueEpochMillis = null,
                updatedEpochMillis = nowMillis,
                dirtySync = true
            )
            is TriageAction.DropConsciously -> task.copy(
                isCompleted = true,
                blockerNote = "Consciously dropped / eliminated without guilt",
                completedEpochMillis = nowMillis,
                updatedEpochMillis = nowMillis,
                dirtySync = true
            )
        }
    }
}
