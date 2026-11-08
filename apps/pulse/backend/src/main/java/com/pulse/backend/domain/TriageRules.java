package com.pulse.backend.domain;

import com.pulse.backend.domain.TaskItem.TaskCommitmentState;
import com.pulse.backend.domain.TaskItem.TaskEnergyLevel;

import java.time.LocalDate;
import java.time.ZoneId;

public final class TriageRules {
    private static final long STAGNANT_DAYS_THRESHOLD = 5L;
    private static final int CHRONIC_DEFER_THRESHOLD = 2;

    private TriageRules() {}

    public sealed interface TriageEligibility {
        record Overdue(long daysOverdue) implements TriageEligibility {}
        record ChronicDeferral(int count) implements TriageEligibility {}
        record UntouchedStagnant(long daysUntouched) implements TriageEligibility {}
    }

    public sealed interface TriageAction {
        record CommitToday() implements TriageAction {}
        record ShrinkTo5m() implements TriageAction {}
        record Reschedule(LocalDate targetDate) implements TriageAction {}
        record Delegate(String waitingOn) implements TriageAction {}
        record ParkSomeday() implements TriageAction {}
        record DropConsciously() implements TriageAction {}
    }

    public static TriageEligibility evaluateTriageEligibility(
            TaskItem task,
            LocalDate today,
            ZoneId zone,
            long nowMillis
    ) {
        if (task.isCompleted() || task.commitment() == TaskCommitmentState.SOMEDAY_PARKED) {
            return null;
        }
        long daysOverdue = task.daysOverdue(today, zone);
        if (daysOverdue > 0) {
            return new TriageEligibility.Overdue(daysOverdue);
        }
        if (task.deferCount() >= CHRONIC_DEFER_THRESHOLD) {
            return new TriageEligibility.ChronicDeferral(task.deferCount());
        }
        if (task.dueEpochMillis() == null && task.daysSinceUpdated(nowMillis) >= STAGNANT_DAYS_THRESHOLD) {
            return new TriageEligibility.UntouchedStagnant(task.daysSinceUpdated(nowMillis));
        }
        return null;
    }

    public static TaskItem applyTriageAction(
            TaskItem task,
            TriageAction action,
            LocalDate today,
            ZoneId zone,
            long nowMillis
    ) {
        return switch (action) {
            case TriageAction.CommitToday ignored -> new TaskItem(
                    task.id(), task.googleTaskId(), task.taskListId(), task.taskListTitle(),
                    task.title(), task.notes(), task.isCompleted(),
                    today.atStartOfDay(zone).toInstant().toEpochMilli(),
                    task.completedEpochMillis(), task.createdEpochMillis(), nowMillis,
                    task.deferCount(), TaskCommitmentState.TODAY_TOP_3, task.energy(),
                    task.blockerNote(), true
            );
            case TriageAction.ShrinkTo5m ignored -> {
                String cleanTitle = task.title().startsWith("5m starter: ")
                        ? task.title()
                        : "5m starter: " + task.title();
                yield new TaskItem(
                        task.id(), task.googleTaskId(), task.taskListId(), task.taskListTitle(),
                        cleanTitle, task.notes(), task.isCompleted(),
                        today.atStartOfDay(zone).toInstant().toEpochMilli(),
                        task.completedEpochMillis(), task.createdEpochMillis(), nowMillis,
                        task.deferCount(), TaskCommitmentState.TODAY_TOP_3, TaskEnergyLevel.QUICK_WIN,
                        task.blockerNote(), true
                );
            }
            case TriageAction.Reschedule reschedule -> new TaskItem(
                    task.id(), task.googleTaskId(), task.taskListId(), task.taskListTitle(),
                    task.title(), task.notes(), task.isCompleted(),
                    reschedule.targetDate().atStartOfDay(zone).toInstant().toEpochMilli(),
                    task.completedEpochMillis(), task.createdEpochMillis(), nowMillis,
                    task.deferCount() + 1, TaskCommitmentState.DEFERRED_INTENTIONALLY, task.energy(),
                    task.blockerNote(), true
            );
            case TriageAction.Delegate delegate -> new TaskItem(
                    task.id(), task.googleTaskId(), task.taskListId(), task.taskListTitle(),
                    task.title(), task.notes(), task.isCompleted(),
                    task.dueEpochMillis(), task.completedEpochMillis(),
                    task.createdEpochMillis(), nowMillis,
                    task.deferCount(), TaskCommitmentState.NORMAL, task.energy(),
                    "Waiting on: " + delegate.waitingOn().trim(), true
            );
            case TriageAction.ParkSomeday ignored -> new TaskItem(
                    task.id(), task.googleTaskId(), task.taskListId(), task.taskListTitle(),
                    task.title(), task.notes(), task.isCompleted(),
                    null, task.completedEpochMillis(),
                    task.createdEpochMillis(), nowMillis,
                    task.deferCount(), TaskCommitmentState.SOMEDAY_PARKED, task.energy(),
                    task.blockerNote(), true
            );
            case TriageAction.DropConsciously ignored -> new TaskItem(
                    task.id(), task.googleTaskId(), task.taskListId(), task.taskListTitle(),
                    task.title(), task.notes(), true,
                    task.dueEpochMillis(), nowMillis,
                    task.createdEpochMillis(), nowMillis,
                    task.deferCount(), task.commitment(), task.energy(),
                    "Consciously dropped / eliminated without guilt", true
            );
        };
    }
}
