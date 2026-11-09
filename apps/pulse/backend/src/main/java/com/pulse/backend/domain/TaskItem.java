package com.pulse.backend.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

public record TaskItem(
        String id,
        String googleTaskId,
        String taskListId,
        String taskListTitle,
        String title,
        String notes,
        boolean isCompleted,
        Long dueEpochMillis,
        Long completedEpochMillis,
        long createdEpochMillis,
        long updatedEpochMillis,
        int deferCount,
        TaskCommitmentState commitment,
        TaskEnergyLevel energy,
        String blockerNote,
        boolean dirtySync
) {
    public enum TaskCommitmentState {
        NORMAL,
        TODAY_TOP_3,
        DEFERRED_INTENTIONALLY,
        SOMEDAY_PARKED
    }

    public enum TaskEnergyLevel {
        QUICK_WIN("5m Quick Win", 5),
        FOCUSED("25m Focus", 25),
        DEEP_WORK("60m+ Deep Prep", 60);

        private final String label;
        private final int minutesEstimate;

        TaskEnergyLevel(String label, int minutesEstimate) {
            this.label = label;
            this.minutesEstimate = minutesEstimate;
        }

        public String label() {
            return label;
        }

        public int minutesEstimate() {
            return minutesEstimate;
        }
    }

    public LocalDate dueLocalDate(ZoneId zoneId) {
        if (dueEpochMillis == null) {
            return null;
        }
        return Instant.ofEpochMilli(dueEpochMillis).atZone(zoneId).toLocalDate();
    }

    public long daysOverdue(LocalDate today, ZoneId zoneId) {
        if (isCompleted) {
            return 0L;
        }
        LocalDate due = dueLocalDate(zoneId);
        if (due == null) {
            return 0L;
        }
        return due.isBefore(today) ? ChronoUnit.DAYS.between(due, today) : 0L;
    }

    public long daysSinceUpdated(long nowMillis) {
        long diff = Math.max(0L, nowMillis - updatedEpochMillis);
        return diff / 86_400_000L;
    }

    public TaskItem withCommitment(TaskCommitmentState newCommitment, long nowMillis) {
        return new TaskItem(
                id, googleTaskId, taskListId, taskListTitle, title, notes, isCompleted,
                dueEpochMillis, completedEpochMillis, createdEpochMillis, nowMillis,
                deferCount, newCommitment, energy, blockerNote, true
        );
    }

    public TaskItem withCompleted(boolean completed, Long completedAtMillis, String note, long nowMillis) {
        return new TaskItem(
                id, googleTaskId, taskListId, taskListTitle, title, notes, completed,
                dueEpochMillis, completedAtMillis, createdEpochMillis, nowMillis,
                deferCount, commitment, energy, note != null ? note : blockerNote, true
        );
    }
}
