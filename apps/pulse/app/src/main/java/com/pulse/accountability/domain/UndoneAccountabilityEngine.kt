package com.pulse.accountability.domain

import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskItemEntity
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

enum class AccountabilityCategory {
    HABITUALLY_DEFERRED,
    LONG_STANDING_GHOSTED,
    ACTIVE_COMMITTED,
    HEALTHY_BACKLOG,
    COMPLETED_OR_PARKED
}

data class TaskAccountabilityStatus(
    val task: TaskItemEntity,
    val category: AccountabilityCategory,
    val badgeLabel: String,
    val daysOld: Long,
    val daysUntouched: Long,
    val daysOverdue: Long
)

enum class ChatRole {
    PARTNER,
    USER
}

data class ConversationalMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: ChatRole,
    val text: String,
    val suggestedAction: TriageAction? = null
)

object UndoneAccountabilityEngine {

    /**
     * Pure deterministic classification of a task into its accountability category.
     */
    fun classifyTask(
        task: TaskItemEntity,
        today: LocalDate = LocalDate.now(),
        nowMillis: Long = System.currentTimeMillis(),
        zoneId: ZoneId = ZoneId.systemDefault()
    ): TaskAccountabilityStatus {
        val daysOld = ((nowMillis - task.createdEpochMillis).coerceAtLeast(0L)) / 86_400_000L
        val daysUntouched = task.daysSinceUpdated(nowMillis)
        val daysOverdue = task.daysOverdue(today, zoneId)

        if (task.isCompleted || task.commitment == TaskCommitmentState.SOMEDAY_PARKED) {
            return TaskAccountabilityStatus(
                task = task,
                category = AccountabilityCategory.COMPLETED_OR_PARKED,
                badgeLabel = if (task.isCompleted) "Completed" else "Parked in Someday",
                daysOld = daysOld,
                daysUntouched = daysUntouched,
                daysOverdue = daysOverdue
            )
        }

        if (task.commitment == TaskCommitmentState.TODAY_TOP_3) {
            val suffix = if (task.deferCount > 0) " • Deferred ${task.deferCount}×" else ""
            return TaskAccountabilityStatus(
                task = task,
                category = AccountabilityCategory.ACTIVE_COMMITTED,
                badgeLabel = "Committed Today$suffix",
                daysOld = daysOld,
                daysUntouched = daysUntouched,
                daysOverdue = daysOverdue
            )
        }

        if (task.deferCount >= 2) {
            val agePart = if (daysOld > 0) " • ${daysOld}d old" else ""
            return TaskAccountabilityStatus(
                task = task,
                category = AccountabilityCategory.HABITUALLY_DEFERRED,
                badgeLabel = "Deferred ${task.deferCount}×$agePart",
                daysOld = daysOld,
                daysUntouched = daysUntouched,
                daysOverdue = daysOverdue
            )
        }

        if (daysOverdue > 0 || daysUntouched >= 5 || daysOld >= 7) {
            val label = when {
                daysOverdue > 0 -> "${daysOverdue}d overdue"
                daysUntouched >= 5 -> "${daysUntouched}d untouched"
                else -> "Standing for ${daysOld}d"
            }
            return TaskAccountabilityStatus(
                task = task,
                category = AccountabilityCategory.LONG_STANDING_GHOSTED,
                badgeLabel = label,
                daysOld = daysOld,
                daysUntouched = daysUntouched,
                daysOverdue = daysOverdue
            )
        }

        return TaskAccountabilityStatus(
            task = task,
            category = AccountabilityCategory.HEALTHY_BACKLOG,
            badgeLabel = "Active",
            daysOld = daysOld,
            daysUntouched = daysUntouched,
            daysOverdue = daysOverdue
        )
    }

    /**
     * Generates the opening message for a barebones conversational check-in on a specific task.
     */
    fun buildInitialReflectionThread(
        task: TaskItemEntity,
        today: LocalDate = LocalDate.now(),
        nowMillis: Long = System.currentTimeMillis(),
        zoneId: ZoneId = ZoneId.systemDefault()
    ): List<ConversationalMessage> {
        val status = classifyTask(task, today, nowMillis, zoneId)
        val prompt = when (status.category) {
            AccountabilityCategory.HABITUALLY_DEFERRED ->
                "You've carried \"${task.title}\" across ${task.deferCount} times (${status.daysOld} days). Zero guilt—what's the real friction holding this back right now?"
            AccountabilityCategory.LONG_STANDING_GHOSTED -> when {
                status.daysOverdue > 0 ->
                    "\"${task.title}\" is ${status.daysOverdue} days past due. Is it still important, or is something blocking the first step?"
                else ->
                    "\"${task.title}\" has been sitting untouched for ${status.daysUntouched.coerceAtLeast(status.daysOld)} days. Want to talk through why it's stalling?"
            }
            else ->
                "Let's look at \"${task.title}\". What would make this effortless to finish today?"
        }

        return listOf(
            ConversationalMessage(
                role = ChatRole.PARTNER,
                text = prompt
            )
        )
    }

    /**
     * Pure conversational response generator that listens to the user's reflection and proposes a concrete resolution.
     */
    fun generatePartnerReply(
        task: TaskItemEntity,
        userMessage: String,
        today: LocalDate = LocalDate.now()
    ): ConversationalMessage {
        val lower = userMessage.lowercase()

        return when {
            lower.contains("big") || lower.contains("vague") || lower.contains("start") ||
            lower.contains("overwhelm") || lower.contains("number") || lower.contains("find") ||
            lower.contains("shrink") || lower.contains("5m") -> {
                ConversationalMessage(
                    role = ChatRole.PARTNER,
                    text = "That makes complete sense. When a task has hidden setup friction, our brain avoids it. Let's shrink \"${task.title}\" to a tiny 5-minute starter step so you can knock it out right now.",
                    suggestedAction = TriageAction.ShrinkTo5m
                )
            }

            lower.contains("wait") || lower.contains("someone") || lower.contains("blocked") ||
            lower.contains("reply") || lower.contains("delegate") -> {
                ConversationalMessage(
                    role = ChatRole.PARTNER,
                    text = "Got it—you shouldn't carry guilt for something waiting on someone else. Let's mark this as Waiting-On and log your blocker note.",
                    suggestedAction = TriageAction.Delegate(userMessage.trim())
                )
            }

            lower.contains("not a priority") || lower.contains("drop") || lower.contains("let it go") ||
            lower.contains("don't care") || lower.contains("irrelevant") || lower.contains("someday") -> {
                ConversationalMessage(
                    role = ChatRole.PARTNER,
                    text = "Honesty is the whole point of accountability. Let's consciously drop or park this so it stops draining your attention.",
                    suggestedAction = TriageAction.DropConsciously
                )
            }

            lower.contains("tomorrow") || lower.contains("later") || lower.contains("busy") ||
            lower.contains("reschedule") -> {
                ConversationalMessage(
                    role = ChatRole.PARTNER,
                    text = "Fair enough. Let's intentionally reschedule it for tomorrow so your plate today stays honest and realistic.",
                    suggestedAction = TriageAction.Reschedule(today.plusDays(1))
                )
            }

            else -> {
                ConversationalMessage(
                    role = ChatRole.PARTNER,
                    text = "Thanks for naming that: \"$userMessage\". I'll save that note on the task. Want to lock it into Today's Top 3 or shrink it to a 5-minute starter?",
                    suggestedAction = TriageAction.CommitToday
                )
            }
        }
    }
}
