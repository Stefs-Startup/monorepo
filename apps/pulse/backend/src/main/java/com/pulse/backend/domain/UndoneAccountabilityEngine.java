package com.pulse.backend.domain;

import com.pulse.backend.domain.TaskItem.TaskCommitmentState;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class UndoneAccountabilityEngine {

    private UndoneAccountabilityEngine() {}

    public record TaskAccountabilityStatus(
            TaskItem task,
            AccountabilityCategory category,
            String badgeLabel,
            long daysOld,
            long daysUntouched,
            long daysOverdue
    ) {}

    public enum ChatRole {
        PARTNER,
        USER
    }

    public record ConversationalMessage(
            String id,
            ChatRole role,
            String text,
            String suggestedActionCode
    ) {
        public static ConversationalMessage partner(String text, String suggestedActionCode) {
            return new ConversationalMessage(UUID.randomUUID().toString(), ChatRole.PARTNER, text, suggestedActionCode);
        }

        public static ConversationalMessage user(String text) {
            return new ConversationalMessage(UUID.randomUUID().toString(), ChatRole.USER, text, null);
        }
    }

    /**
     * Pure deterministic classification of a task into its accountability category.
     */
    public static TaskAccountabilityStatus classifyTask(
            TaskItem task,
            LocalDate today,
            long nowMillis,
            ZoneId zoneId
    ) {
        long daysOld = Math.max(0L, nowMillis - task.createdEpochMillis()) / 86_400_000L;
        long daysUntouched = task.daysSinceUpdated(nowMillis);
        long daysOverdue = task.daysOverdue(today, zoneId);

        if (task.isCompleted() || task.commitment() == TaskCommitmentState.SOMEDAY_PARKED) {
            return new TaskAccountabilityStatus(
                    task,
                    AccountabilityCategory.COMPLETED_OR_PARKED,
                    task.isCompleted() ? "Completed" : "Parked in Someday",
                    daysOld,
                    daysUntouched,
                    daysOverdue
            );
        }

        if (task.commitment() == TaskCommitmentState.TODAY_TOP_3) {
            String suffix = task.deferCount() > 0 ? " • Deferred " + task.deferCount() + "×" : "";
            return new TaskAccountabilityStatus(
                    task,
                    AccountabilityCategory.ACTIVE_COMMITTED,
                    "Committed Today" + suffix,
                    daysOld,
                    daysUntouched,
                    daysOverdue
            );
        }

        if (task.deferCount() >= 2) {
            String agePart = daysOld > 0 ? " • " + daysOld + "d old" : "";
            return new TaskAccountabilityStatus(
                    task,
                    AccountabilityCategory.HABITUALLY_DEFERRED,
                    "Deferred " + task.deferCount() + "×" + agePart,
                    daysOld,
                    daysUntouched,
                    daysOverdue
            );
        }

        if (daysOverdue > 0 || daysUntouched >= 5 || daysOld >= 7) {
            String label;
            if (daysOverdue > 0) {
                label = daysOverdue + "d overdue";
            } else if (daysUntouched >= 5) {
                label = daysUntouched + "d untouched";
            } else {
                label = "Standing for " + daysOld + "d";
            }
            return new TaskAccountabilityStatus(
                    task,
                    AccountabilityCategory.LONG_STANDING_GHOSTED,
                    label,
                    daysOld,
                    daysUntouched,
                    daysOverdue
            );
        }

        return new TaskAccountabilityStatus(
                task,
                AccountabilityCategory.HEALTHY_BACKLOG,
                "Active",
                daysOld,
                daysUntouched,
                daysOverdue
        );
    }

    /**
     * Generates the opening message for a conversational check-in on a specific task.
     */
    public static List<ConversationalMessage> buildInitialReflectionThread(
            TaskItem task,
            LocalDate today,
            long nowMillis,
            ZoneId zoneId
    ) {
        TaskAccountabilityStatus status = classifyTask(task, today, nowMillis, zoneId);
        String prompt = switch (status.category()) {
            case HABITUALLY_DEFERRED ->
                    "You've carried \"" + task.title() + "\" across " + task.deferCount() +
                            " times (" + status.daysOld() + " days). Zero guilt—what's the real friction holding this back right now?";
            case LONG_STANDING_GHOSTED -> status.daysOverdue() > 0
                    ? "\"" + task.title() + "\" is " + status.daysOverdue() + " days past due. Is it still important, or is something blocking the first step?"
                    : "\"" + task.title() + "\" has been sitting untouched for " +
                    Math.max(status.daysUntouched(), status.daysOld()) + " days. Want to talk through why it's stalling?";
            default ->
                    "Let's look at \"" + task.title() + "\". What would make this effortless to finish today?";
        };

        return List.of(ConversationalMessage.partner(prompt, null));
    }

    /**
     * Pure conversational response generator that listens to the user's reflection and proposes a concrete resolution.
     */
    public static ConversationalMessage generatePartnerReply(
            TaskItem task,
            String userMessage
    ) {
        String lower = userMessage.toLowerCase(Locale.ROOT);

        if (lower.contains("big") || lower.contains("vague") || lower.contains("start") ||
                lower.contains("overwhelm") || lower.contains("number") || lower.contains("find") ||
                lower.contains("shrink") || lower.contains("5m")) {
            return ConversationalMessage.partner(
                    "That makes complete sense. When a task has hidden setup friction, our brain avoids it. Let's shrink \"" +
                            task.title() + "\" to a tiny 5-minute starter step so you can knock it out right now.",
                    "SHRINK_TO_5M"
            );
        }

        if (lower.contains("wait") || lower.contains("someone") || lower.contains("blocked") ||
                lower.contains("reply") || lower.contains("delegate")) {
            return ConversationalMessage.partner(
                    "Got it—you shouldn't carry guilt for something waiting on someone else. Let's mark this as Waiting-On and log your blocker note.",
                    "DELEGATE"
            );
        }

        if (lower.contains("not a priority") || lower.contains("drop") || lower.contains("let it go") ||
                lower.contains("don't care") || lower.contains("irrelevant") || lower.contains("someday")) {
            return ConversationalMessage.partner(
                    "Honesty is the whole point of accountability. Let's consciously drop or park this so it stops draining your attention.",
                    "DROP_CONSCIOUSLY"
            );
        }

        if (lower.contains("tomorrow") || lower.contains("later") || lower.contains("busy") ||
                lower.contains("reschedule")) {
            return ConversationalMessage.partner(
                    "Fair enough. Let's intentionally reschedule it for tomorrow so your plate today stays honest and realistic.",
                    "RESCHEDULE"
            );
        }

        return ConversationalMessage.partner(
                "Thanks for naming that: \"" + userMessage + "\". I'll save that note on the task. Want to lock it into Today's Top 3 or shrink it to a 5-minute starter?",
                "COMMIT_TODAY"
        );
    }
}
