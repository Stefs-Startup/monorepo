package com.pulse.accountability.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

@Serializable
enum class TaskEnergyLevel(val label: String, val minutesEstimate: Int) {
    QUICK_WIN("5m Quick Win", 5),
    FOCUSED("25m Focus", 25),
    DEEP_WORK("60m+ Deep Prep", 60)
}

@Serializable
enum class TaskCommitmentState {
    NORMAL,
    TODAY_TOP_3,      // Committed as one of today's max-3 non-negotiables
    DEFERRED_INTENTIONALLY, // Deliberately pushed to next week or later
    SOMEDAY_PARKED    // Let go from active pressure
}

@Entity(tableName = "tasks")
data class TaskItemEntity(
    @PrimaryKey val id: String,
    val googleTaskId: String? = null,
    val taskListId: String = "@default",
    val taskListTitle: String = "My Tasks",
    val title: String,
    val notes: String = "",
    val isCompleted: Boolean = false,
    val dueEpochMillis: Long? = null,
    val completedEpochMillis: Long? = null,
    val createdEpochMillis: Long = System.currentTimeMillis(),
    val updatedEpochMillis: Long = System.currentTimeMillis(),
    // Accountability Partner Metadata
    val deferCount: Int = 0,
    val commitmentState: String = TaskCommitmentState.NORMAL.name,
    val energyLevel: String = TaskEnergyLevel.FOCUSED.name,
    val prepChecklistJson: String = "[]", // Serialized List<PrepStep>
    val blockerNote: String = "",
    val linkedGoalId: String? = null,
    val dirtySync: Boolean = false
) {
    val commitment: TaskCommitmentState
        get() = runCatching { TaskCommitmentState.valueOf(commitmentState) }
            .getOrDefault(TaskCommitmentState.NORMAL)

    val energy: TaskEnergyLevel
        get() = runCatching { TaskEnergyLevel.valueOf(energyLevel) }
            .getOrDefault(TaskEnergyLevel.FOCUSED)

    fun dueLocalDate(zoneId: ZoneId = ZoneOffset.UTC): LocalDate? =
        dueEpochMillis?.let { Instant.ofEpochMilli(it).atZone(zoneId).toLocalDate() }

    fun daysOverdue(today: LocalDate = LocalDate.now(), zoneId: ZoneId = ZoneOffset.UTC): Long {
        if (isCompleted) return 0
        val due = dueLocalDate(zoneId) ?: return 0
        return if (due.isBefore(today)) ChronoUnit.DAYS.between(due, today) else 0
    }

    fun daysUntilDue(today: LocalDate = LocalDate.now(), zoneId: ZoneId = ZoneOffset.UTC): Long? {
        val due = dueLocalDate(zoneId) ?: return null
        return ChronoUnit.DAYS.between(today, due)
    }

    fun daysSinceUpdated(nowMillis: Long = System.currentTimeMillis()): Long {
        val diff = (nowMillis - updatedEpochMillis).coerceAtLeast(0L)
        return diff / (1000L * 60 * 60 * 24)
    }

    /**
     * A task is "Forgotten / Ghosted" if it is incomplete and:
     * - Has no due date and hasn't been touched in 5+ days, OR
     * - Has been deferred 2+ times, OR
     * - Is overdue by 1+ days
     */
    fun isUndoneOrForgotten(today: LocalDate = LocalDate.now()): Boolean {
        if (isCompleted) return false
        if (commitment == TaskCommitmentState.SOMEDAY_PARKED) return false
        return daysOverdue(today) > 0 || deferCount >= 2 || (dueEpochMillis == null && daysSinceUpdated() >= 5)
    }

    /**
     * A task "Needs Preparation" if it's due in the next 1 to 5 days and either requires Deep Work
     * or has no preparation checklist completed yet.
     */
    fun needsPreparationSoon(today: LocalDate = LocalDate.now()): Boolean {
        if (isCompleted) return false
        val daysUntil = daysUntilDue(today) ?: return (energy == TaskEnergyLevel.DEEP_WORK)
        return daysUntil in 1..5 && (energy == TaskEnergyLevel.DEEP_WORK || notes.isNotBlank() || prepChecklistJson == "[]")
    }
}

@Serializable
data class PrepStep(
    val id: String,
    val title: String,
    val isDone: Boolean = false
)

@Entity(tableName = "weekly_goals")
data class WeeklyGoalEntity(
    @PrimaryKey val id: String,
    val weekStartIsoDate: String, // e.g., "2026-10-19"
    val title: String,
    val whyItMatters: String,
    val targetCount: Int = 3,
    val completedCount: Int = 0,
    val isArchived: Boolean = false
)

@Entity(tableName = "reflections")
data class ReflectionEntryEntity(
    @PrimaryKey val id: String,
    val dateIso: String, // "2026-10-22"
    val type: String, // "MORNING_CHECKIN", "EVENING_SHUTDOWN", "WEEKLY_RESET"
    val moodScore: Int, // 1..5
    val winHighlight: String,
    val leftUndoneReflection: String,
    val tomorrowPrepNote: String,
    val tasksCompletedCount: Int,
    val tasksTriagedCount: Int,
    val createdAtMillis: Long = System.currentTimeMillis()
)
